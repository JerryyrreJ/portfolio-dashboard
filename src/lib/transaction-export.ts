import type { Prisma } from '@prisma/client';
import { format } from 'date-fns';
import prisma from '@/lib/prisma';
import { findOwnedPortfolio } from '@/lib/ownership';

const VALID_EXPORT_TYPES = new Set(['BUY', 'SELL', 'DIVIDEND']);
const VALID_EXPORT_RANGES = new Set(['all', 'ytd', '12m']);

export type TransactionExportFormat = 'csv' | 'json';
export type TransactionExportRange = 'all' | 'ytd' | '12m';
export type TransactionExportType = 'BUY' | 'SELL' | 'DIVIDEND';

export type TransactionExportRequest = {
  portfolioId?: string;
  ticker?: string;
  type?: TransactionExportType;
  range: TransactionExportRange;
};

export type TransactionExportItem = {
  transactionId: string;
  portfolioId: string;
  portfolioName: string;
  date: string;
  ticker: string;
  name: string;
  market: string;
  type: string;
  quantity: number;
  price: number;
  priceUSD: number;
  currency: string;
  exchangeRate: number;
  fee: number;
  grossAmount: number;
  grossAmountUSD: number;
  totalValue: string;
  totalValueUSD: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionExportPayload = {
  portfolio: {
    id: string;
    name: string;
    currency: string;
  };
  exportDate: string;
  range: TransactionExportRange;
  filters: {
    ticker: string | null;
    type: TransactionExportType | null;
  };
  transactionCount: number;
  transactions: TransactionExportItem[];
};

function normalizeString(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getRangeDateFilter(range: TransactionExportRange): Prisma.DateTimeFilter | undefined {
  const now = new Date();

  if (range === 'ytd') {
    return { gte: new Date(now.getFullYear(), 0, 1) };
  }

  if (range === '12m') {
    const lastYear = new Date(now);
    lastYear.setFullYear(now.getFullYear() - 1);
    return { gte: lastYear };
  }

  return undefined;
}

function getGrossAmount(type: string, quantity: number, price: number) {
  return type === 'DIVIDEND' ? price : Math.abs(quantity) * price;
}

export function parseTransactionExportRequest(searchParams: URLSearchParams): TransactionExportRequest {
  const rawRange = normalizeString(searchParams.get('range'));
  const rawType = normalizeString(searchParams.get('type'))?.toUpperCase();
  const rawTicker = normalizeString(searchParams.get('ticker'));
  const portfolioId = normalizeString(searchParams.get('portfolioId')) ?? normalizeString(searchParams.get('pid'));

  return {
    portfolioId,
    ticker: rawTicker?.toUpperCase(),
    type: rawType && VALID_EXPORT_TYPES.has(rawType) ? rawType as TransactionExportType : undefined,
    range: rawRange && VALID_EXPORT_RANGES.has(rawRange) ? rawRange as TransactionExportRange : 'all',
  };
}

export function parseTransactionExportFormat(searchParams: URLSearchParams): TransactionExportFormat {
  const rawFormat = normalizeString(searchParams.get('format'))?.toLowerCase();
  return rawFormat === 'json' ? 'json' : 'csv';
}

export async function getTransactionExportPayload(
  userId: string,
  request: TransactionExportRequest
): Promise<TransactionExportPayload | null> {
  const resolvedPortfolio = request.portfolioId
    ? await findOwnedPortfolio(userId, request.portfolioId)
    : await prisma.portfolio.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
      });

  if (!resolvedPortfolio) {
    return null;
  }

  const dateFilter = getRangeDateFilter(request.range);
  const where: Prisma.TransactionWhereInput = {
    portfolioId: resolvedPortfolio.id,
    ...(request.type ? { type: request.type } : {}),
    ...(request.ticker
      ? {
          asset: {
            ticker: {
              contains: request.ticker,
              mode: 'insensitive',
            },
          },
        }
      : {}),
    ...(dateFilter ? { date: dateFilter } : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      asset: true,
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  const exportItems: TransactionExportItem[] = transactions.map((transaction) => {
    const grossAmount = getGrossAmount(transaction.type, transaction.quantity, transaction.price);
    const grossAmountUSD = getGrossAmount(transaction.type, transaction.quantity, transaction.priceUSD);

    return {
      transactionId: transaction.id,
      portfolioId: resolvedPortfolio.id,
      portfolioName: resolvedPortfolio.name,
      date: format(new Date(transaction.date), 'yyyy-MM-dd'),
      ticker: transaction.asset.ticker,
      name: transaction.asset.name,
      market: transaction.asset.market,
      type: transaction.type,
      quantity: Math.abs(transaction.quantity),
      price: transaction.price,
      priceUSD: transaction.priceUSD,
      currency: transaction.currency || 'USD',
      exchangeRate: transaction.exchangeRate,
      fee: transaction.fee ?? 0,
      grossAmount,
      grossAmountUSD,
      totalValue: grossAmount.toFixed(2),
      totalValueUSD: grossAmountUSD.toFixed(2),
      notes: transaction.notes ?? '',
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  });

  return {
    portfolio: {
      id: resolvedPortfolio.id,
      name: resolvedPortfolio.name,
      currency: resolvedPortfolio.currency,
    },
    exportDate: new Date().toISOString(),
    range: request.range,
    filters: {
      ticker: request.ticker ?? null,
      type: request.type ?? null,
    },
    transactionCount: exportItems.length,
    transactions: exportItems,
  };
}

function escapeCsvValue(value: string | number) {
  const raw = String(value);
  return raw.includes(',') || raw.includes('"') || raw.includes('\n')
    ? `"${raw.replace(/"/g, '""')}"`
    : raw;
}

function formatCsvAmount(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function serializeTransactionExportCsv(payload: TransactionExportPayload) {
  const header = 'Date,Ticker,Name,Market,Type,Quantity,Price,Currency,Fee,Total Value,Notes\n';
  const rows = payload.transactions.map((transaction) => ([
    transaction.date,
    escapeCsvValue(transaction.ticker),
    escapeCsvValue(transaction.name),
    escapeCsvValue(transaction.market),
    transaction.type,
    transaction.quantity,
    formatCsvAmount(transaction.price),
    transaction.currency,
    formatCsvAmount(transaction.fee),
    formatCsvAmount(transaction.grossAmount),
    escapeCsvValue(transaction.notes),
  ].join(',')));

  return header + rows.join('\n');
}

export function buildTransactionExportFilename(
  format: TransactionExportFormat,
  payload: TransactionExportPayload
) {
  const safePortfolioName = payload.portfolio.name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    || 'portfolio';

  return `portfolio_transactions_${safePortfolioName}_${payload.range}.${format}`;
}
