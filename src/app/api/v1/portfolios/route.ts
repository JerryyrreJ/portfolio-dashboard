import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/auth';
import { withPublicApiHeaders, publicApiOptionsResponse } from '@/lib/api/cors';
import { apiError } from '@/lib/api/errors';
import { applyRateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function GET(request: NextRequest) {
  const preAuthLimit = await applyRateLimit(request, {
    keyPrefix: 'api:v1:portfolios:ip',
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
    keyPrefix: 'api:v1:portfolios:key',
    identifier: apiKey.id,
    limit: 60,
    windowMs: 60_000,
  });
  if (!keyLimit.allowed) {
    return apiError(429, 'RATE_LIMITED', 'Too many requests for this API key.', undefined, withPublicApiHeaders(keyLimit.headers));
  }

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: apiKey.userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    portfolios: portfolios.map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      currency: portfolio.currency,
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString(),
    })),
  }, { headers: withPublicApiHeaders(keyLimit.headers) });
}
