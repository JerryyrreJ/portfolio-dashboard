import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/ownership';
import type { LedgerBootstrapPayload } from '@/lib/ledger/types';

export async function GET() {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id },
    include: {
      transactions: {
        include: { asset: true },
        orderBy: { date: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const payload: LedgerBootstrapPayload = {
    portfolios: portfolios.map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      currency: portfolio.currency,
      preferences: portfolio.preferences,
      settingsUpdatedAt: portfolio.settingsUpdatedAt?.toISOString() ?? null,
      updatedAt: portfolio.updatedAt.toISOString(),
    })),
    transactions: portfolios.flatMap((portfolio) => portfolio.transactions.map((transaction) => ({
      id: transaction.id,
      portfolioId: transaction.portfolioId,
      type: transaction.type as 'BUY' | 'SELL' | 'DIVIDEND',
      eventId: transaction.eventId,
      source: transaction.source,
      subtype: transaction.subtype,
      isSystemGenerated: transaction.isSystemGenerated,
      date: transaction.date.toISOString(),
      quantity: transaction.quantity,
      price: transaction.price,
      priceUSD: transaction.priceUSD,
      exchangeRate: transaction.exchangeRate,
      fee: transaction.fee,
      currency: transaction.currency,
      notes: transaction.notes,
      updatedAt: transaction.updatedAt.toISOString(),
      asset: {
        ticker: transaction.asset.ticker,
        name: transaction.asset.name,
        market: transaction.asset.market,
        currency: transaction.asset.currency,
        logo: transaction.asset.logo,
      },
    }))),
  };

  return NextResponse.json(payload);
}
