import type { ApiErrorDetail } from '@/lib/api/errors';
import { normalizeSupportedCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency';
import { inferCurrencyFromTicker, inferMarketFromTicker, normalizeTicker } from '@/lib/transactions/ticker';

export const MAX_IMPORT_TRANSACTIONS = 100;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_CLIENT_KEY_LENGTH = 128;
export const MAX_TRANSACTION_QUANTITY = 1_000_000_000_000;
export const MAX_TRANSACTION_MONEY = 1_000_000_000_000;
export const MAX_TRANSACTION_TOTAL = 1_000_000_000_000_000;
export const IMPORT_SOURCE = 'api';

export type TradeType = 'BUY' | 'SELL';

export function parsePositiveNumber(value: unknown, maximum = MAX_TRANSACTION_MONEY): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > maximum) {
    return null;
  }
  return value;
}

export function parseNonNegativeNumber(
  value: unknown,
  fallback = 0,
  maximum = MAX_TRANSACTION_MONEY,
): number | null {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    return null;
  }
  return value;
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

function hasValidCalendarDate(value: string) {
  const datePart = value.slice(0, 10);
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === datePart;
}

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value !== value.trim()) {
    return null;
  }
  if (!ISO_DATE_ONLY.test(value) && !ISO_DATE_TIME.test(value)) {
    return null;
  }
  if (!hasValidCalendarDate(value)) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function isTransactionTotalWithinLimit(quantity: number, price: number, fee = 0) {
  const grossAmount = quantity * price;
  const totalAmount = grossAmount + fee;
  return Number.isFinite(grossAmount)
    && Number.isFinite(totalAmount)
    && grossAmount <= MAX_TRANSACTION_TOTAL
    && totalAmount <= MAX_TRANSACTION_TOTAL;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type ParsedImportItem = {
  index: number;
  type: TradeType;
  date: Date;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  notes: string | null;
  ticker: string;
  name: string;
  market: string;
  clientKey: string | null;
};

function parseOptionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') {
    return { ok: true as const, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false as const };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true as const, value: null };
  }
  if (trimmed.length > maxLength) {
    return { ok: false as const };
  }
  return { ok: true as const, value: trimmed };
}

function parseCurrency(value: unknown, ticker: string) {
  if (value === undefined || value === null || value === '') {
    return inferCurrencyFromTicker(ticker);
  }
  return normalizeSupportedCurrency(value);
}

function parseMarket(value: unknown, ticker: string) {
  if (value === undefined || value === null || value === '') {
    return inferMarketFromTicker(ticker);
  }
  if (typeof value !== 'string') return null;
  const market = value.trim().toUpperCase();
  if (!/^[A-Z]{1,8}$/.test(market)) return null;
  return market;
}

export function parseImportItem(value: unknown, index: number): {
  item?: ParsedImportItem;
  errors: ApiErrorDetail[];
} {
  const errors: ApiErrorDetail[] = [];
  if (!isRecord(value)) {
    return {
      errors: [{
        index,
        code: 'INVALID_ITEM',
        message: 'Each transaction must be an object.',
      }],
    };
  }

  const tradeType = typeof value.type === 'string' && ['BUY', 'SELL'].includes(value.type)
    ? value.type as TradeType
    : null;
  if (!tradeType) {
    errors.push({
      index,
      field: 'type',
      code: 'INVALID_TYPE',
      message: 'type must be BUY or SELL.',
    });
  }

  const ticker = normalizeTicker(value.ticker ?? value.symbol);
  if (!ticker) {
    errors.push({
      index,
      field: value.ticker === undefined && value.symbol !== undefined ? 'symbol' : 'ticker',
      code: 'INVALID_TICKER',
      message: 'ticker (or symbol) is required and must be 1-32 alphanumeric characters, optionally with . or -.',
    });
  }

  const quantity = parsePositiveNumber(value.quantity, MAX_TRANSACTION_QUANTITY);
  if (quantity === null) {
    errors.push({
      index,
      field: 'quantity',
      code: 'INVALID_QUANTITY',
      message: `quantity must be a positive number no greater than ${MAX_TRANSACTION_QUANTITY}.`,
    });
  }

  const price = parsePositiveNumber(value.price);
  if (price === null) {
    errors.push({
      index,
      field: 'price',
      code: 'INVALID_PRICE',
      message: `price must be a positive number no greater than ${MAX_TRANSACTION_MONEY}.`,
    });
  }

  const fee = parseNonNegativeNumber(value.fee, 0);
  if (fee === null) {
    errors.push({
      index,
      field: 'fee',
      code: 'INVALID_FEE',
      message: `fee must be a non-negative number no greater than ${MAX_TRANSACTION_MONEY}.`,
    });
  }

  const date = parseIsoDate(value.date);
  if (date === null) {
    errors.push({
      index,
      field: 'date',
      code: 'INVALID_DATE',
      message: 'date must be a valid ISO-8601 date or datetime string.',
    });
  }

  const currency = ticker ? parseCurrency(value.currency, ticker) : null;
  if (ticker && currency === null) {
    errors.push({
      index,
      field: 'currency',
      code: 'INVALID_CURRENCY',
      message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}.`,
    });
  }

  const market = ticker ? parseMarket(value.market, ticker) : null;
  if (ticker && market === null) {
    errors.push({
      index,
      field: 'market',
      code: 'INVALID_MARKET',
      message: 'market must be a short market code when provided.',
    });
  }

  const notes = parseOptionalString(value.notes, MAX_NOTES_LENGTH);
  if (!notes.ok) {
    errors.push({
      index,
      field: 'notes',
      code: 'INVALID_NOTES',
      message: `notes must be a string of at most ${MAX_NOTES_LENGTH} characters.`,
    });
  }

  const name = parseOptionalString(value.name, 120);
  if (!name.ok) {
    errors.push({
      index,
      field: 'name',
      code: 'INVALID_NAME',
      message: 'name must be a string of at most 120 characters.',
    });
  }

  const clientKey = parseOptionalString(value.clientKey ?? value.fingerprint, MAX_CLIENT_KEY_LENGTH);
  if (!clientKey.ok) {
    errors.push({
      index,
      field: 'clientKey',
      code: 'INVALID_CLIENT_KEY',
      message: `clientKey must be a string of at most ${MAX_CLIENT_KEY_LENGTH} characters.`,
    });
  }

  if (
    quantity !== null
    && price !== null
    && fee !== null
    && !isTransactionTotalWithinLimit(quantity, price, fee)
  ) {
    errors.push({
      index,
      field: 'quantity',
      code: 'TRANSACTION_VALUE_TOO_LARGE',
      message: `quantity × price + fee must not exceed ${MAX_TRANSACTION_TOTAL}.`,
    });
  }

  if (errors.length > 0 || !tradeType || !ticker || quantity === null || price === null || fee === null || date === null || !currency || !market) {
    return { errors };
  }

  return {
    item: {
      index,
      type: tradeType,
      date,
      quantity,
      price,
      fee,
      currency,
      notes: notes.ok ? notes.value : null,
      ticker,
      name: (name.ok ? name.value : null) ?? ticker,
      market,
      clientKey: clientKey.ok ? clientKey.value : null,
    },
    errors: [],
  };
}

export function parseImportRequest(body: unknown): {
  portfolioId?: string;
  dryRun: boolean;
  idempotencyKey?: string;
  items: ParsedImportItem[];
  errors: ApiErrorDetail[];
  code?: string;
  message?: string;
} {
  if (!isRecord(body)) {
    return {
      dryRun: false,
      items: [],
      errors: [],
      code: 'INVALID_BODY',
      message: 'Request body must be a JSON object.',
    };
  }

  if (typeof body.portfolioId !== 'string' || !body.portfolioId.trim()) {
    return {
      dryRun: false,
      items: [],
      errors: [{ field: 'portfolioId', code: 'MISSING_PORTFOLIO_ID', message: 'portfolioId is required.' }],
      code: 'VALIDATION_ERROR',
      message: 'portfolioId is required.',
    };
  }

  if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') {
    return {
      dryRun: false,
      items: [],
      errors: [{ field: 'dryRun', code: 'INVALID_DRY_RUN', message: 'dryRun must be a boolean when provided.' }],
      code: 'VALIDATION_ERROR',
      message: 'dryRun must be a boolean when provided.',
    };
  }

  if (!Array.isArray(body.transactions)) {
    return {
      dryRun: Boolean(body.dryRun),
      items: [],
      errors: [{ field: 'transactions', code: 'INVALID_TRANSACTIONS', message: 'transactions must be an array.' }],
      code: 'VALIDATION_ERROR',
      message: 'transactions must be an array.',
    };
  }

  if (body.transactions.length === 0) {
    return {
      dryRun: Boolean(body.dryRun),
      items: [],
      errors: [{ field: 'transactions', code: 'EMPTY_TRANSACTIONS', message: 'transactions must contain at least one item.' }],
      code: 'EMPTY_TRANSACTIONS',
      message: 'transactions must contain at least one item.',
    };
  }

  if (body.transactions.length > MAX_IMPORT_TRANSACTIONS) {
    return {
      dryRun: Boolean(body.dryRun),
      items: [],
      errors: [{
        field: 'transactions',
        code: 'TOO_MANY_TRANSACTIONS',
        message: `transactions cannot exceed ${MAX_IMPORT_TRANSACTIONS} items.`,
      }],
      code: 'TOO_MANY_TRANSACTIONS',
      message: `transactions cannot exceed ${MAX_IMPORT_TRANSACTIONS} items.`,
    };
  }

  const items: ParsedImportItem[] = [];
  const errors: ApiErrorDetail[] = [];
  const seenClientKeys = new Map<string, number>();

  body.transactions.forEach((entry, index) => {
    const parsed = parseImportItem(entry, index);
    errors.push(...parsed.errors);
    if (!parsed.item) return;

    if (parsed.item.clientKey) {
      const previous = seenClientKeys.get(parsed.item.clientKey);
      if (previous !== undefined) {
        errors.push({
          index,
          field: 'clientKey',
          code: 'DUPLICATE_CLIENT_KEY',
          message: `clientKey is duplicated in this request (also used at index ${previous}).`,
        });
        return;
      }
      seenClientKeys.set(parsed.item.clientKey, index);
    }

    items.push(parsed.item);
  });

  if (errors.length > 0) {
    return {
      portfolioId: body.portfolioId.trim(),
      dryRun: Boolean(body.dryRun),
      items: [],
      errors,
      code: 'VALIDATION_ERROR',
      message: 'One or more transactions are invalid.',
    };
  }

  return {
    portfolioId: body.portfolioId.trim(),
    dryRun: Boolean(body.dryRun),
    items,
    errors: [],
  };
}

export function toNormalizedPreview(item: ParsedImportItem) {
  return {
    type: item.type,
    ticker: item.ticker,
    name: item.name,
    market: item.market,
    date: item.date.toISOString(),
    quantity: item.quantity,
    price: item.price,
    fee: item.fee,
    currency: item.currency,
    notes: item.notes,
    clientKey: item.clientKey,
  };
}
