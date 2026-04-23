import type { Prisma } from '@prisma/client';
import { format } from 'date-fns';
import prisma from '@/lib/prisma';
import { findOwnedPortfolio } from '@/lib/ownership';
import {
  buildTransactionExportFilename,
  buildTransactionExportPayload,
  getRangeStartDate,
  getTransactionGrossAmount,
  normalizeString,
  normalizeTransactionExportRange,
  normalizeTransactionExportTicker,
  normalizeTransactionExportType,
  serializeTransactionExportCsv,
  type TransactionExportFormat,
  type TransactionExportItem,
  type TransactionExportPayload,
  type TransactionExportRange,
  type TransactionExportRequest,
} from '@/lib/export-core';

function getRangeDateFilter(range: TransactionExportRange): Prisma.DateTimeFilter | undefined {
  const startDate = getRangeStartDate(range);

  if (startDate) {
    return { gte: startDate };
  }

  return undefined;
}

export function parseTransactionExportRequest(searchParams: URLSearchParams): TransactionExportRequest {
  const rawRange = normalizeString(searchParams.get('range'));
  const rawType = normalizeString(searchParams.get('type'));
  const rawTicker = normalizeString(searchParams.get('ticker'));
  const portfolioId = normalizeString(searchParams.get('portfolioId')) ?? normalizeString(searchParams.get('pid'));

  return {
    portfolioId,
    ticker: normalizeTransactionExportTicker(rawTicker) ?? undefined,
    type: normalizeTransactionExportType(rawType) ?? undefined,
    range: normalizeTransactionExportRange(rawRange),
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
    const grossAmount = getTransactionGrossAmount(transaction.type, transaction.quantity, transaction.price);
    const grossAmountUSD = getTransactionGrossAmount(transaction.type, transaction.quantity, transaction.priceUSD);

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

  return buildTransactionExportPayload({
    portfolio: {
      id: resolvedPortfolio.id,
      name: resolvedPortfolio.name,
      currency: resolvedPortfolio.currency,
    },
    range: request.range,
    transactions: exportItems,
    ticker: request.ticker ?? null,
    type: request.type ?? null,
  });
}

export { buildTransactionExportFilename, serializeTransactionExportCsv };
