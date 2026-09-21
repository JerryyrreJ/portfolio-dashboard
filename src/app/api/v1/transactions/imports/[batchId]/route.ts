import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/auth';
import { withPublicApiHeaders, publicApiOptionsResponse } from '@/lib/api/cors';
import { apiError } from '@/lib/api/errors';
import { applyRateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { isImportBatchId } from '@/lib/transactions/batch';

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const preAuthLimit = await applyRateLimit(request, {
    keyPrefix: 'api:v1:transactions:imports:ip',
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
    keyPrefix: 'api:v1:transactions:imports:key',
    identifier: apiKey.id,
    limit: 60,
    windowMs: 60_000,
  });
  if (!keyLimit.allowed) {
    return apiError(429, 'RATE_LIMITED', 'Too many undo requests for this API key.', undefined, withPublicApiHeaders(keyLimit.headers));
  }

  const { batchId } = await context.params;
  if (!isImportBatchId(batchId)) {
    return apiError(404, 'IMPORT_BATCH_NOT_FOUND', 'Import batch not found.', undefined, withPublicApiHeaders(keyLimit.headers));
  }

  const result = await prisma.transaction.deleteMany({
    where: {
      importBatchId: batchId,
      portfolio: {
        userId: apiKey.userId,
      },
    },
  });

  if (result.count === 0) {
    return apiError(404, 'IMPORT_BATCH_NOT_FOUND', 'Import batch not found.', undefined, withPublicApiHeaders(keyLimit.headers));
  }

  return NextResponse.json({
    success: true,
    importBatchId: batchId,
    deleted: result.count,
  }, { headers: withPublicApiHeaders(keyLimit.headers) });
}
