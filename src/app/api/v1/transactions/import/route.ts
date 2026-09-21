import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/auth';
import { withPublicApiHeaders, publicApiOptionsResponse } from '@/lib/api/cors';
import { apiError, type ApiErrorDetail } from '@/lib/api/errors';
import {
  IdempotencyConflict,
  runIdempotentImport,
  hashRequestPayload,
  readIdempotencyKey,
  MAX_IDEMPOTENCY_KEY_LENGTH,
} from '@/lib/api/idempotency';
import { applyRateLimit } from '@/lib/rate-limit';
import { findOwnedPortfolio } from '@/lib/ownership';
import { importTransactionsInTransaction, previewImportItems, ratesByCurrency } from '@/lib/transactions/import';
import { isRecord, parseImportRequest } from '@/lib/transactions/parse';

class ClientKeyConflict extends Error {
  constructor(public readonly details: ApiErrorDetail[]) {
    super('One or more clientKey values already exist on different transactions.');
  }
}

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function POST(request: NextRequest) {
  const preAuthLimit = await applyRateLimit(request, {
    keyPrefix: 'api:v1:transactions:import:ip',
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
    keyPrefix: 'api:v1:transactions:import:key',
    identifier: apiKey.id,
    limit: 60,
    windowMs: 60_000,
  });
  if (!keyLimit.allowed) {
    return apiError(429, 'RATE_LIMITED', 'Too many import requests for this API key.', undefined, withPublicApiHeaders(keyLimit.headers));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'INVALID_BODY', 'Request body must be JSON.', undefined, withPublicApiHeaders(keyLimit.headers));
  }

  if (!isRecord(body)) {
    return apiError(400, 'INVALID_BODY', 'Request body must be a JSON object.', undefined, withPublicApiHeaders(keyLimit.headers));
  }

  const parsed = parseImportRequest(body);
  if (parsed.code && parsed.message) {
    const status = parsed.code === 'TOO_MANY_TRANSACTIONS' ? 413 : 400;
    return apiError(status, parsed.code, parsed.message, parsed.errors, withPublicApiHeaders(keyLimit.headers));
  }

  const portfolio = await findOwnedPortfolio(apiKey.userId, parsed.portfolioId!);
  if (!portfolio) {
    return apiError(404, 'PORTFOLIO_NOT_FOUND', 'Portfolio not found.', [
      { field: 'portfolioId', code: 'PORTFOLIO_NOT_FOUND', message: 'Portfolio not found or not owned by this API key.' },
    ], withPublicApiHeaders(keyLimit.headers));
  }

  const idempotencyKey = readIdempotencyKey(request, body);
  if (idempotencyKey && idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return apiError(400, 'INVALID_IDEMPOTENCY_KEY', `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`, [
      { field: 'idempotencyKey', code: 'INVALID_IDEMPOTENCY_KEY', message: `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.` },
    ], withPublicApiHeaders(keyLimit.headers));
  }

  const requestHash = hashRequestPayload({
    portfolioId: parsed.portfolioId,
    dryRun: parsed.dryRun,
    transactions: body.transactions,
  });

  if (parsed.dryRun) {
    const results = previewImportItems(parsed.items);
    return NextResponse.json({
      success: true,
      dryRun: true,
      imported: 0,
      results,
    }, { headers: withPublicApiHeaders(keyLimit.headers) });
  }

  try {
    // External FX requests stay outside the database transaction/lock.
    const rates = await ratesByCurrency(parsed.items);
    const result = await runIdempotentImport(
      idempotencyKey ? { userId: apiKey.userId, key: idempotencyKey, requestHash } : null,
      async (tx) => {
        const { results, conflicts, importBatchId } = await importTransactionsInTransaction(tx, {
          portfolioId: portfolio.id,
          items: parsed.items,
          rates,
        });
        if (conflicts.length > 0) throw new ClientKeyConflict(conflicts);
        return {
          success: true,
          dryRun: false,
          importBatchId,
          imported: results.filter((item) => item.status === 'created').length,
          replayed: results.filter((item) => item.status === 'existing').length,
          results,
        };
      },
    );
    return NextResponse.json(result.payload, {
      status: result.statusCode,
      headers: withPublicApiHeaders({
        ...keyLimit.headers,
        ...(result.replayed ? { 'Idempotency-Replayed': 'true' } : {}),
      }),
    });
  } catch (error) {
    if (error instanceof IdempotencyConflict) {
      return apiError(409, error.code, error.message, undefined, withPublicApiHeaders(keyLimit.headers));
    }
    if (error instanceof ClientKeyConflict) {
      return apiError(409, 'CLIENT_KEY_CONFLICT', error.message, error.details, withPublicApiHeaders(keyLimit.headers));
    }
    console.error('Failed to import transactions:', error);
    const prismaCode = (error as { code?: string }).code;
    if (prismaCode === 'P2002') {
      return apiError(
        409,
        'CLIENT_KEY_CONFLICT',
        'A clientKey collided with an existing transaction. Retry with the same clientKey or fetch the existing trade.',
        undefined,
        withPublicApiHeaders(keyLimit.headers)
      );
    }
    return apiError(500, 'IMPORT_FAILED', 'Failed to import transactions.', undefined, withPublicApiHeaders(keyLimit.headers));
  }
}
