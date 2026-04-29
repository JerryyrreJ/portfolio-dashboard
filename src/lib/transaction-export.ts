import type { Prisma } from '@prisma/client';
import { format } from 'date-fns';
import prisma from '@/lib/prisma';
import { findOwnedPortfolio, getOwnedPortfolioIds } from '@/lib/ownership';
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
import {
  buildPortfolioSelectionLabel,
  parsePortfolioIdList,
} from '@/lib/portfolio-selection';

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
  const portfolioIds = parsePortfolioIdList(searchParams.get('pids'));

  return {
    portfolioId,
    portfolioIds,
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
  const allPortfolios = await prisma.portfolio.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  const allowedIds = new Set(await getOwnedPortfolioIds(userId));
  const selectedPortfolioIds = request.portfolioIds && request.portfolioIds.length > 0
    ? request.portfolioIds.filter((id) => allowedIds.has(id))
    : [];

  const resolvedPortfolio = request.portfolioId
    ? await findOwnedPortfolio(userId, request.portfolioId)
    : allPortfolios[0] ?? null;

  if (!resolvedPortfolio) {
    return null;
  }

  const effectivePortfolioIds = selectedPortfolioIds.length > 0
    ? selectedPortfolioIds
    : [resolvedPortfolio.id];
  const selectedPortfolios = allPortfolios.filter((portfolio) => effectivePortfolioIds.includes(portfolio.id));
  const selectionLabel = buildPortfolioSelectionLabel(
    {
      portfolioIds: effectivePortfolioIds,
      primaryPortfolioId: effectivePortfolioIds[0] ?? null,
      mode: effectivePortfolioIds.length > 1 ? 'multi' : 'single',
      isAllSelected: allPortfolios.length > 0 && effectivePortfolioIds.length === allPortfolios.length,
      canWrite: effectivePortfolioIds.length === 1,
      selectedCount: effectivePortfolioIds.length,
      rawRequestedIds: effectivePortfolioIds,
    },
    selectedPortfolios,
    {
      allLabel: 'All Portfolios',
      countLabel: (count) => `${count} Portfolios`,
    },
  );

  const dateFilter = getRangeDateFilter(request.range);
  const where: Prisma.TransactionWhereInput = {
    portfolioId: { in: effectivePortfolioIds },
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
      portfolio: true,
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
      portfolioId: transaction.portfolioId,
      portfolioName: transaction.portfolio.name,
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
      id: effectivePortfolioIds.length === 1 ? resolvedPortfolio.id : 'multi-portfolio',
      name: effectivePortfolioIds.length === 1 ? resolvedPortfolio.name : selectionLabel,
      currency: effectivePortfolioIds.length === 1 ? resolvedPortfolio.currency : resolvedPortfolio.currency,
    },
    selection: {
      portfolioIds: effectivePortfolioIds,
      label: selectionLabel,
      mode: effectivePortfolioIds.length > 1 ? 'multi' : 'single',
    },
    portfolios: selectedPortfolios.map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      currency: portfolio.currency,
    })),
    range: request.range,
    transactions: exportItems,
    ticker: request.ticker ?? null,
    type: request.type ?? null,
  });
}

export { buildTransactionExportFilename, serializeTransactionExportCsv };
