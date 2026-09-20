import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/auth';
import { withPublicApiHeaders, publicApiOptionsResponse } from '@/lib/api/cors';
import { apiError } from '@/lib/api/errors';
import {
  completeIdempotencyRecord,
  findIdempotencyRecord,
  hashRequestPayload,
  readIdempotencyKey,
  releaseIdempotencyRecord,
  saveIdempotencyRecord,
  MAX_IDEMPOTENCY_KEY_LENGTH,
} from '@/lib/api/idempotency';
import { applyRateLimit } from '@/lib/rate-limit';
import { findOwnedPortfolio } from '@/lib/ownership';
import { importTransactionsAtomically, previewImportItems } from '@/lib/transactions/import';
import { isRecord, parseImportRequest } from '@/lib/transactions/parse';

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

  let reservedIdempotencyKey: string | null = null;

  if (idempotencyKey && !parsed.dryRun) {
    const existing = await findIdempotencyRecord(apiKey.userId, idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return apiError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency-Key was already used with a different request body.',
          undefined,
          withPublicApiHeaders(keyLimit.headers)
        );
      }
      if (existing.statusCode === 202) {
        return apiError(
          409,
          'IDEMPOTENCY_IN_PROGRESS',
          'A request with this Idempotency-Key is already in progress. Retry shortly.',
          undefined,
          withPublicApiHeaders(keyLimit.headers)
        );
      }
      return NextResponse.json(JSON.parse(existing.responseJson), {
        status: existing.statusCode,
        headers: withPublicApiHeaders({
          ...keyLimit.headers,
          'Idempotency-Replayed': 'true',
        }),
      });
    }

    const reserved = await saveIdempotencyRecord({
      userId: apiKey.userId,
      key: idempotencyKey,
      requestHash,
      statusCode: 202,
      responseJson: JSON.stringify({ pending: true }),
    });

    if (!reserved) {
      return apiError(409, 'IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is already in progress. Retry shortly.', undefined, withPublicApiHeaders(keyLimit.headers));
    }
    if (reserved.requestHash !== requestHash) {
      return apiError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency-Key was already used with a different request body.',
        undefined,
        withPublicApiHeaders(keyLimit.headers)
      );
    }
    if (reserved.statusCode !== 202) {
      return NextResponse.json(JSON.parse(reserved.responseJson), {
        status: reserved.statusCode,
        headers: withPublicApiHeaders({
          ...keyLimit.headers,
          'Idempotency-Replayed': 'true',
        }),
      });
    }
    reservedIdempotencyKey = idempotencyKey;
  }

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
    const { results, conflicts, importBatchId } = await importTransactionsAtomically({
      portfolioId: portfolio.id,
      items: parsed.items,
    });

    if (conflicts.length > 0) {
      if (reservedIdempotencyKey) {
        await releaseIdempotencyRecord(apiKey.userId, reservedIdempotencyKey);
      }
      return apiError(
        409,
        'CLIENT_KEY_CONFLICT',
        'One or more clientKey values already exist on different transactions.',
        conflicts,
        withPublicApiHeaders(keyLimit.headers)
      );
    }

    const payload = {
      success: true,
      dryRun: false,
      importBatchId,
      imported: results.filter((result) => result.status === 'created').length,
      replayed: results.filter((result) => result.status === 'existing').length,
      results,
    };

    if (reservedIdempotencyKey) {
      await completeIdempotencyRecord({
        userId: apiKey.userId,
        key: reservedIdempotencyKey,
        statusCode: 200,
        responseJson: JSON.stringify(payload),
      });
    }

    return NextResponse.json(payload, { headers: withPublicApiHeaders(keyLimit.headers) });
  } catch (error) {
    if (reservedIdempotencyKey) {
      await releaseIdempotencyRecord(apiKey.userId, reservedIdempotencyKey).catch(() => undefined);
    }
    console.error('Failed to import transactions:', error);
    const prismaCode = (error as { code?: string }).code;
    if (prismaCode === 'P2002') {
      return apiError(
        409,
        'CLIENT_KEY_CONFLICT',
        'A clientKey in this request collided with an existing transaction. Retry with a new clientKey or fetch the existing trade.',
        undefined,
        withPublicApiHeaders(keyLimit.headers)
      );
    }
    return apiError(500, 'IMPORT_FAILED', 'Failed to import transactions.', undefined, withPublicApiHeaders(keyLimit.headers));
  }
}
