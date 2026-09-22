export type TransactionExportFormat = 'csv' | 'json';
export type TransactionExportRange = 'all' | 'ytd' | '12m';
export type TransactionExportType = 'BUY' | 'SELL' | 'DIVIDEND';

export type TransactionExportRequest = {
  portfolioId?: string;
  portfolioIds?: string[];
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
  selection?: {
    portfolioIds: string[];
    label: string;
    mode: 'single' | 'multi';
  };
  portfolios?: Array<{
    id: string;
    name: string;
    currency: string;
  }>;
  exportDate: string;
  range: TransactionExportRange;
  filters: {
    ticker: string | null;
    type: TransactionExportType | null;
  };
  transactionCount: number;
  transactions: TransactionExportItem[];
};

type ExportPortfolioMeta = {
  id: string;
  name: string;
  currency: string;
};

type BuildTransactionExportPayloadOptions = {
  portfolio: ExportPortfolioMeta;
  selection?: TransactionExportPayload['selection'];
  portfolios?: TransactionExportPayload['portfolios'];
  range: TransactionExportRange;
  ticker?: string | null;
  type?: TransactionExportType | null;
  transactions: TransactionExportItem[];
};

const VALID_EXPORT_TYPES = new Set<TransactionExportType>(['BUY', 'SELL', 'DIVIDEND']);
const VALID_EXPORT_RANGES = new Set<TransactionExportRange>(['all', 'ytd', '12m']);

export function normalizeString(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeTransactionExportRange(range?: string | null): TransactionExportRange {
  return range && VALID_EXPORT_RANGES.has(range as TransactionExportRange)
    ? range as TransactionExportRange
    : 'all';
}

export function normalizeTransactionExportType(type?: string | null): TransactionExportType | null {
  const normalized = type?.trim().toUpperCase();
  return normalized && VALID_EXPORT_TYPES.has(normalized as TransactionExportType)
    ? normalized as TransactionExportType
    : null;
}

export function normalizeTransactionExportTicker(ticker?: string | null) {
  return ticker?.trim().toUpperCase() || null;
}

export function getRangeStartDate(range: TransactionExportRange) {
  const now = new Date();

  if (range === 'ytd') {
    return new Date(now.getFullYear(), 0, 1);
  }

  if (range === '12m') {
    const lastYear = new Date(now);
    lastYear.setFullYear(now.getFullYear() - 1);
    return lastYear;
  }

  return null;
}

export function getTransactionGrossAmount(type: string, quantity: number, price: number) {
  return type === 'DIVIDEND' ? price : Math.abs(quantity) * price;
}

export function buildTransactionExportPayload(
  options: BuildTransactionExportPayloadOptions
): TransactionExportPayload {
  const ticker = normalizeTransactionExportTicker(options.ticker);
  const type = options.type ?? null;

  return {
    portfolio: options.portfolio,
    selection: options.selection,
    portfolios: options.portfolios,
    exportDate: new Date().toISOString(),
    range: options.range,
    filters: {
      ticker,
      type,
    },
    transactionCount: options.transactions.length,
    transactions: options.transactions,
  };
}

const CSV_FORMULA_PREFIX = /^[\u0000-\u0020\u007f-\u009f\ufeff]*[=+\-@]/u;
const CSV_LEADING_CONTROL = /^[\u0000-\u001f\u007f-\u009f\ufeff]/u;

export function escapeCsvValue(value: string | number) {
  const raw = String(value);
  const neutralized = typeof value === 'string'
    && (CSV_FORMULA_PREFIX.test(raw) || CSV_LEADING_CONTROL.test(raw))
    ? `'${raw}`
    : raw;
  return /[",\r\n]/.test(neutralized)
    ? `"${neutralized.replace(/"/g, '""')}"`
    : neutralized;
}

function formatCsvAmount(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function serializeTransactionExportCsv(payload: TransactionExportPayload) {
  const header = 'Date,Portfolio,Ticker,Name,Market,Type,Quantity,Price,Currency,Fee,Total Value,Notes\n';
  const rows = payload.transactions.map((transaction) => ([
    transaction.date,
    transaction.portfolioName,
    transaction.ticker,
    transaction.name,
    transaction.market,
    transaction.type,
    transaction.quantity,
    formatCsvAmount(transaction.price),
    transaction.currency,
    formatCsvAmount(transaction.fee),
    formatCsvAmount(transaction.grossAmount),
    transaction.notes,
  ].map(escapeCsvValue).join(',')));

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
