import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { toPublicApiKey } from '@/lib/api/auth';
import {
  generateApiKey,
  MAX_API_KEYS_PER_USER,
  normalizeApiKeyName,
} from '@/lib/api/keys';
import { applyRateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/ownership';

export async function GET() {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Sign in to manage API keys.');
  }

  const keys = await prisma.apiKey.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastFour: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json({ keys: keys.map(toPublicApiKey) });
}

export async function POST(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Sign in to manage API keys.');
  }

  const rateLimit = await applyRateLimit(request, {
    keyPrefix: `api:settings:api-keys:create:${user.id}`,
    identifier: user.id,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return apiError(429, 'RATE_LIMITED', 'Too many API key creation attempts.', undefined, rateLimit.headers);
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const name = normalizeApiKeyName(
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>).name : undefined
  );
  if (name === null) {
    return apiError(400, 'VALIDATION_ERROR', 'name must be a string of at most 80 characters.', [
      { field: 'name', code: 'INVALID_NAME', message: 'name must be a string of at most 80 characters.' },
    ], rateLimit.headers);
  }

  const activeCount = await prisma.apiKey.count({
    where: { userId: user.id, revokedAt: null },
  });
  if (activeCount >= MAX_API_KEYS_PER_USER) {
    return apiError(
      400,
      'API_KEY_LIMIT',
      `You can have at most ${MAX_API_KEYS_PER_USER} active API keys.`,
      undefined,
      rateLimit.headers
    );
  }

  const generated = generateApiKey();
  const record = await prisma.apiKey.create({
    data: {
      userId: user.id,
      name,
      prefix: generated.prefix,
      lastFour: generated.lastFour,
      keyHash: generated.keyHash,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastFour: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json({
    key: {
      ...toPublicApiKey(record),
      secret: generated.plaintext,
    },
  }, { status: 201, headers: rateLimit.headers });
}
