import type { ApiKey } from '@prisma/client';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { hashApiKey, looksLikeApiKey } from '@/lib/api/keys';

const LAST_USED_TOUCH_MS = 60_000;

export type AuthenticatedApiKey = {
  id: string;
  userId: string;
  name: string;
};

function readBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export async function authenticateApiKey(
  request: NextRequest
): Promise<AuthenticatedApiKey | null> {
  const token = readBearerToken(request);
  if (!token || !looksLikeApiKey(token)) {
    return null;
  }

  const keyHash = hashApiKey(token);
  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      userId: true,
      name: true,
      revokedAt: true,
      lastUsedAt: true,
    },
  });

  if (!record || record.revokedAt) {
    return null;
  }

  const lastUsedAt = record.lastUsedAt?.getTime() ?? 0;
  if (Date.now() - lastUsedAt > LAST_USED_TOUCH_MS) {
    void prisma.apiKey
      .update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((error) => {
        console.warn('Failed to touch API key lastUsedAt:', error);
      });
  }

  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
  };
}

export function toPublicApiKey(record: Pick<
  ApiKey,
  'id' | 'name' | 'prefix' | 'lastFour' | 'createdAt' | 'lastUsedAt'
>) {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    lastFour: record.lastFour,
    createdAt: record.createdAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
  };
}
