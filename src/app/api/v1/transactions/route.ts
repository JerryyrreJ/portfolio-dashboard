import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/auth';
import { withPublicApiHeaders, publicApiOptionsResponse } from '@/lib/api/cors';
import { apiError } from '@/lib/api/errors';
import { applyRateLimit } from '@/lib/rate-limit';
import { findOwnedPortfolio } from '@/lib/ownership';
import prisma from '@/lib/prisma';
import {
  encodeTransactionCursor,
  parseTransactionListQuery,
} from '@/lib/transactions/list';

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function GET(request: NextRequest) {
  const preAuthLimit = await applyRateLimit(request, {
    keyPrefix: 'api:v1:transactions:list:ip',
    limit: 60,
    windowMs: 60_000,
  });
  if (!preAuthLimit.allowed) {
    return apiError(429, 'RATE_LIMITED', 'Too many requests.', undefined, withPublicApiHeaders(preAuthLimit.headers));
  }

  const apiKey = await authenticateApiKey(request);
  if (!apiKey) {
    return apiError(401, 'UNAUTHORIZED', 'Invalid or missing API key. Use Authorization: Bearer <api_key>.', undefined, withPublicApiHeaders());
  }

  const keyLimit = await applyRateLimit(request, {
    keyPrefix: 'api:v1:transactions:list:key',
    identifier: apiKey.id,
    limit: 60,
    windowMs: 60_000,
  });
  if (!keyLimit.allowed) {
    return apiError(429, 'RATE_LIMITED', 'Too many list requests for this API key.', undefined, withPublicApiHeaders(keyLimit.headers));
  }

  const parsed = parseTransactionListQuery(request.nextUrl.searchParams);
  if (!parsed.query) {
    return apiError(
      400,
      parsed.code ?? 'VALIDATION_ERROR',
      parsed.message ?? 'Invalid query parameters.',
      parsed.errors,
      withPublicApiHeaders(keyLimit.headers)
    );
  }

  const portfolio = await findOwnedPortfolio(apiKey.userId, parsed.query.portfolioId);
  if (!portfolio) {
    return apiError(404, 'PORTFOLIO_NOT_FOUND', 'Portfolio not found.', [
      { field: 'portfolioId', code: 'PORTFOLIO_NOT_FOUND', message: 'Portfolio not found or not owned by this API key.' },
    ], withPublicApiHeaders(keyLimit.headers));
  }

  const { limit, since, until, cursor } = parsed.query;

  const rows = await prisma.transaction.findMany({
    where: {
      portfolioId: portfolio.id,
      portfolio: { userId: apiKey.userId },
      ...(since || until
        ? {
            date: {
              ...(since ? { gte: since } : {}),
              ...(until ? { lte: until } : {}),
            },
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { date: { lt: cursor.date } },
              {
                AND: [
                  { date: cursor.date },
                  { id: { lt: cursor.id } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: [
      { date: 'desc' },
      { id: 'desc' },
    ],
    take: limit + 1,
    select: {
      id: true,
      portfolioId: true,
      type: true,
      quantity: true,
      price: true,
      fee: true,
      date: true,
      currency: true,
      notes: true,
      importKey: true,
      importBatchId: true,
      source: true,
      asset: {
        select: {
          ticker: true,
          name: true,
          market: true,
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return NextResponse.json({
    transactions: page.map((transaction) => ({
      id: transaction.id,
      portfolioId: transaction.portfolioId,
      type: transaction.type,
      date: transaction.date.toISOString(),
      quantity: transaction.quantity,
      price: transaction.price,
      fee: transaction.fee,
      currency: transaction.currency,
      notes: transaction.notes,
      clientKey: transaction.importKey,
      importBatchId: transaction.importBatchId,
      source: transaction.source,
      asset: {
        ticker: transaction.asset.ticker,
        name: transaction.asset.name,
        market: transaction.asset.market,
      },
    })),
    nextCursor: hasMore && last ? encodeTransactionCursor(last) : null,
  }, { headers: withPublicApiHeaders(keyLimit.headers) });
}
