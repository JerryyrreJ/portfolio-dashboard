import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/ownership';
import type { LedgerSyncOperation } from '@/lib/ledger/types';

const MAX_OPERATIONS_PER_REQUEST = 200;

type TransactionPayload = {
  id: string;
  portfolioId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  eventId?: string | null;
  source?: string | null;
  subtype?: string | null;
  isSystemGenerated?: boolean;
  date: string;
  quantity: number;
  price: number;
  priceUSD: number;
  exchangeRate: number;
  fee: number;
  currency: string;
  notes?: string | null;
  asset: {
    ticker: string;
  };
};

type PortfolioPayload = {
  id: string;
  name: string;
  currency: string;
  preferences?: string | null;
  settingsUpdatedAt?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPortfolioPayload(payload: Record<string, unknown>): PortfolioPayload | null {
  if (typeof payload.id !== 'string' || typeof payload.name !== 'string' || typeof payload.currency !== 'string') {
    return null;
  }

  return {
    id: payload.id,
    name: payload.name,
    currency: payload.currency,
    preferences: typeof payload.preferences === 'string' ? payload.preferences : null,
    settingsUpdatedAt: typeof payload.settingsUpdatedAt === 'string' ? payload.settingsUpdatedAt : null,
  };
}

function toTransactionPayload(payload: Record<string, unknown>): TransactionPayload | null {
  if (
    typeof payload.id !== 'string' ||
    typeof payload.portfolioId !== 'string' ||
    typeof payload.type !== 'string' ||
    !['BUY', 'SELL', 'DIVIDEND'].includes(payload.type) ||
    typeof payload.date !== 'string' ||
    typeof payload.quantity !== 'number' ||
    typeof payload.price !== 'number' ||
    typeof payload.priceUSD !== 'number' ||
    typeof payload.exchangeRate !== 'number' ||
    typeof payload.fee !== 'number' ||
    typeof payload.currency !== 'string' ||
    !isRecord(payload.asset) ||
    typeof payload.asset.ticker !== 'string'
  ) {
    return null;
  }

  return {
    id: payload.id,
    portfolioId: payload.portfolioId,
    type: payload.type as TransactionPayload['type'],
    eventId: typeof payload.eventId === 'string' ? payload.eventId : null,
    source: typeof payload.source === 'string' ? payload.source : null,
    subtype: typeof payload.subtype === 'string' ? payload.subtype : null,
    isSystemGenerated: typeof payload.isSystemGenerated === 'boolean' ? payload.isSystemGenerated : false,
    date: payload.date,
    quantity: payload.quantity,
    price: payload.price,
    priceUSD: payload.priceUSD,
    exchangeRate: payload.exchangeRate,
    fee: payload.fee,
    currency: payload.currency,
    notes: typeof payload.notes === 'string' ? payload.notes : null,
    asset: {
      ticker: payload.asset.ticker.toUpperCase(),
    },
  };
}

export async function POST(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const operations = Array.isArray(body.operations) ? body.operations as LedgerSyncOperation[] : [];
  if (operations.length === 0) {
    return NextResponse.json({ ok: true, applied: 0 });
  }
  if (operations.length > MAX_OPERATIONS_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `Too many operations in one request (max ${MAX_OPERATIONS_PER_REQUEST})`,
      },
      { status: 413 }
    );
  }

  const orderedOperations = [...operations].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
  );

  let applied = 0;

  for (const operation of orderedOperations) {
    if (!operation || operation.namespace !== `user:${user.id}` || !isRecord(operation.payload)) {
      continue;
    }

    if (operation.entity === 'portfolio') {
      if (operation.action === 'delete') {
        await prisma.portfolio.deleteMany({
          where: { id: operation.recordId, userId: user.id },
        });
        applied += 1;
        continue;
      }

      const payload = toPortfolioPayload(operation.payload);
      if (!payload) continue;

      const existingPortfolio = await prisma.portfolio.findUnique({
        where: { id: payload.id },
        select: { id: true, userId: true },
      });

      if (!existingPortfolio) {
        await prisma.portfolio.create({
          data: {
            id: payload.id,
            userId: user.id,
            name: payload.name,
            currency: payload.currency,
            preferences: payload.preferences,
            settingsUpdatedAt: payload.settingsUpdatedAt ? new Date(payload.settingsUpdatedAt) : null,
          },
        });
        applied += 1;
        continue;
      }

      if (existingPortfolio.userId !== user.id) {
        continue;
      }

      await prisma.portfolio.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          currency: payload.currency,
          preferences: payload.preferences,
          settingsUpdatedAt: payload.settingsUpdatedAt ? new Date(payload.settingsUpdatedAt) : new Date(),
        },
      });
      applied += 1;
      continue;
    }

    if (operation.entity === 'transaction') {
      if (operation.action === 'delete') {
        await prisma.transaction.deleteMany({
          where: {
            id: operation.recordId,
            portfolio: { userId: user.id },
          },
        });
        applied += 1;
        continue;
      }

      const payload = toTransactionPayload(operation.payload);
      if (!payload) continue;

      const portfolio = await prisma.portfolio.findFirst({
        where: { id: payload.portfolioId, userId: user.id },
        select: { id: true },
      });
      if (!portfolio) continue;

      // Do not trust client-provided asset metadata in sync payloads.
      // Asset profile fields are server-owned and updated by provider sync routes.
      const asset = await prisma.asset.upsert({
        where: { ticker: payload.asset.ticker },
        create: {
          ticker: payload.asset.ticker,
          name: payload.asset.ticker,
          market: 'US',
          currency: 'USD',
        },
        update: {},
        select: { id: true },
      });

      const existingTransaction = await prisma.transaction.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          portfolio: {
            select: { userId: true },
          },
        },
      });

      if (!existingTransaction) {
        await prisma.transaction.create({
          data: {
            id: payload.id,
            portfolioId: payload.portfolioId,
            assetId: asset.id,
            type: payload.type,
            eventId: payload.eventId,
            source: payload.source,
            subtype: payload.subtype,
            isSystemGenerated: payload.isSystemGenerated ?? false,
            date: new Date(payload.date),
            quantity: payload.quantity,
            price: payload.price,
            priceUSD: payload.priceUSD,
            exchangeRate: payload.exchangeRate,
            fee: payload.fee,
            currency: payload.currency,
            notes: payload.notes,
          },
        });
        applied += 1;
        continue;
      }

      if (existingTransaction.portfolio.userId !== user.id) {
        continue;
      }

      await prisma.transaction.update({
        where: { id: payload.id },
        data: {
          assetId: asset.id,
          type: payload.type,
          eventId: payload.eventId,
          source: payload.source,
          subtype: payload.subtype,
          isSystemGenerated: payload.isSystemGenerated ?? false,
          date: new Date(payload.date),
          quantity: payload.quantity,
          price: payload.price,
          priceUSD: payload.priceUSD,
          exchangeRate: payload.exchangeRate,
          fee: payload.fee,
          currency: payload.currency,
          notes: payload.notes,
        },
      });
      applied += 1;
    }
  }

  return NextResponse.json({ ok: true, applied });
}
