import type { ApiErrorDetail } from '@/lib/api/errors';
import { parseIsoDate } from '@/lib/transactions/parse';

export const DEFAULT_TRANSACTION_LIST_LIMIT = 50;
export const MAX_TRANSACTION_LIST_LIMIT = 100;

export type TransactionListCursor = {
  date: Date;
  id: string;
};

export type ParsedTransactionListQuery = {
  portfolioId: string;
  limit: number;
  since: Date | null;
  until: Date | null;
  cursor: TransactionListCursor | null;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseLimit(value: string | null) {
  if (value === null || value === '') {
    return DEFAULT_TRANSACTION_LIST_LIMIT;
  }
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return Math.min(parsed, MAX_TRANSACTION_LIST_LIMIT);
}

function parseBoundaryInstant(value: string, edge: 'start' | 'end') {
  if (DATE_ONLY.test(value)) {
    const parsed = parseIsoDate(value);
    if (!parsed) return null;
    if (edge === 'end') parsed.setUTCHours(23, 59, 59, 999);
    return parsed;
  }
  return parseIsoDate(value);
}

export function encodeTransactionCursor(row: { date: Date; id: string }) {
  return Buffer.from(`${row.date.toISOString()}|${row.id}`, 'utf8').toString('base64url');
}

export function decodeTransactionCursor(value: string): TransactionListCursor | null {
  try {
    const raw = Buffer.from(value, 'base64url').toString('utf8');
    const separator = raw.lastIndexOf('|');
    if (separator <= 0) return null;
    const date = new Date(raw.slice(0, separator));
    const id = raw.slice(separator + 1).trim();
    if (Number.isNaN(date.getTime()) || !id) return null;
    return { date, id };
  } catch {
    return null;
  }
}

export function parseTransactionListQuery(searchParams: URLSearchParams): {
  query?: ParsedTransactionListQuery;
  code?: string;
  message?: string;
  errors?: ApiErrorDetail[];
} {
  const portfolioId = searchParams.get('portfolioId')?.trim() ?? '';
  if (!portfolioId) {
    return {
      code: 'MISSING_PORTFOLIO_ID',
      message: 'portfolioId is required.',
      errors: [{ field: 'portfolioId', code: 'MISSING_PORTFOLIO_ID', message: 'portfolioId is required.' }],
    };
  }

  const limit = parseLimit(searchParams.get('limit'));
  if (limit === null) {
    return {
      code: 'INVALID_LIMIT',
      message: 'limit must be a positive integer.',
      errors: [{ field: 'limit', code: 'INVALID_LIMIT', message: 'limit must be a positive integer.' }],
    };
  }

  const sinceRaw = searchParams.get('since')?.trim() || null;
  const untilRaw = searchParams.get('until')?.trim() || null;
  const since = sinceRaw ? parseBoundaryInstant(sinceRaw, 'start') : null;
  const until = untilRaw ? parseBoundaryInstant(untilRaw, 'end') : null;

  if (sinceRaw && since === null) {
    return {
      code: 'INVALID_SINCE',
      message: 'since must be a valid ISO-8601 date or datetime.',
      errors: [{ field: 'since', code: 'INVALID_SINCE', message: 'since must be a valid ISO-8601 date or datetime.' }],
    };
  }

  if (untilRaw && until === null) {
    return {
      code: 'INVALID_UNTIL',
      message: 'until must be a valid ISO-8601 date or datetime.',
      errors: [{ field: 'until', code: 'INVALID_UNTIL', message: 'until must be a valid ISO-8601 date or datetime.' }],
    };
  }

  if (since && until && since.getTime() > until.getTime()) {
    return {
      code: 'INVALID_DATE_RANGE',
      message: 'since must be less than or equal to until.',
      errors: [{ field: 'since', code: 'INVALID_DATE_RANGE', message: 'since must be less than or equal to until.' }],
    };
  }

  const cursorRaw = searchParams.get('cursor')?.trim() || null;
  const cursor = cursorRaw ? decodeTransactionCursor(cursorRaw) : null;
  if (cursorRaw && cursor === null) {
    return {
      code: 'INVALID_CURSOR',
      message: 'cursor is invalid.',
      errors: [{ field: 'cursor', code: 'INVALID_CURSOR', message: 'cursor is invalid.' }],
    };
  }

  return {
    query: {
      portfolioId,
      limit,
      since,
      until,
      cursor,
    },
  };
}
