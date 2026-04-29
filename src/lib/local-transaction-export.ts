'use client';

import {
  buildTransactionExportFilename,
  buildTransactionExportPayload,
  getRangeStartDate,
  getTransactionGrossAmount,
  normalizeTransactionExportRange,
  normalizeTransactionExportTicker,
  normalizeTransactionExportType,
  serializeTransactionExportCsv,
  type TransactionExportItem,
  type TransactionExportPayload,
} from '@/lib/export-core';

type LocalStoredTransaction = {
  id?: string;
  portfolioId?: string;
  type?: string;
  quantity?: number | string;
  price?: number | string;
  fee?: number | string | null;
  date?: string;
  notes?: string | null;
  currency?: string;
  exchangeRate?: number | string;
  asset?: {
    ticker?: string;
    name?: string;
    market?: string;
    currency?: string;
  };
};

type LocalExportOptions = {
  range?: string;
  ticker?: string | null;
  type?: string | null;
  portfolioName?: string;
  portfolioCurrency?: string;
};
const LOCAL_TRANSACTIONS_KEY = 'local_transactions';
const LOCAL_PORTFOLIO_ID = 'local-portfolio';

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSafeDate(value?: string) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDate(value?: string) {
  return getSafeDate(value).toISOString().slice(0, 10);
}

function readLocalTransactions(): LocalStoredTransaction[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LOCAL_TRANSACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as LocalStoredTransaction[] : [];
  } catch {
    return [];
  }
}

export function getLocalTransactionExportPayload(options: LocalExportOptions = {}): TransactionExportPayload {
  const range = normalizeTransactionExportRange(options.range);
  const typeFilter = normalizeTransactionExportType(options.type);
  const tickerFilter = normalizeTransactionExportTicker(options.ticker);
  const rangeStart = getRangeStartDate(range);
  const portfolioName = options.portfolioName?.trim()
    || localStorage.getItem('portfolio_name')?.trim()
    || 'Local Portfolio';
  const portfolioCurrency = options.portfolioCurrency?.trim()
    || localStorage.getItem('base_currency')?.trim()
    || 'USD';

  const transactions = readLocalTransactions()
    .filter((transaction) => {
      const type = normalizeTransactionExportType(transaction.type);
      const ticker = transaction.asset?.ticker?.trim().toUpperCase() || '';
      const date = getSafeDate(transaction.date);

      if (!type || !ticker) return false;
      if (typeFilter && type !== typeFilter) return false;
      if (tickerFilter && !ticker.includes(tickerFilter)) return false;
      if (rangeStart && date < rangeStart) return false;
      return true;
    })
    .sort((a, b) => getSafeDate(b.date).getTime() - getSafeDate(a.date).getTime())
    .map((transaction): TransactionExportItem => {
      const type = normalizeTransactionExportType(transaction.type) ?? 'BUY';
      const quantity = Math.abs(toNumber(transaction.quantity));
      const price = toNumber(transaction.price);
      const fee = toNumber(transaction.fee);
      const exchangeRate = toNumber(transaction.exchangeRate, 1) || 1;
      const currency = transaction.currency
        || transaction.asset?.currency
        || portfolioCurrency;
      const grossAmount = getTransactionGrossAmount(type, quantity, price);
      const grossAmountUSD = grossAmount * exchangeRate;
      const transactionDate = getSafeDate(transaction.date);
      const timestamp = transactionDate.toISOString();
      const ticker = transaction.asset?.ticker?.trim().toUpperCase() || 'UNKNOWN';

      return {
        transactionId: transaction.id || `local_${timestamp}_${ticker}`,
        portfolioId: transaction.portfolioId || LOCAL_PORTFOLIO_ID,
        portfolioName,
        date: formatDate(transaction.date),
        ticker,
        name: transaction.asset?.name || ticker,
        market: transaction.asset?.market || 'US',
        type,
        quantity,
        price,
        priceUSD: price * exchangeRate,
        currency,
        exchangeRate,
        fee,
        grossAmount,
        grossAmountUSD,
        totalValue: grossAmount.toFixed(2),
        totalValueUSD: grossAmountUSD.toFixed(2),
        notes: transaction.notes ?? '',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });

  return buildTransactionExportPayload({
    portfolio: {
      id: LOCAL_PORTFOLIO_ID,
      name: portfolioName,
      currency: portfolioCurrency,
    },
    range,
    transactions,
    ticker: tickerFilter,
    type: typeFilter,
  });
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export { buildTransactionExportFilename, serializeTransactionExportCsv };
