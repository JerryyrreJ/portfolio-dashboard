import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

export function readIdempotencyKey(request: NextRequest, body: Record<string, unknown>) {
  const fromHeader = request.headers.get('idempotency-key')?.trim();
  if (fromHeader) return fromHeader;

  const fromBody = body.idempotencyKey;
  if (typeof fromBody === 'string' && fromBody.trim()) {
    return fromBody.trim();
  }

  return null;
}

export function hashRequestPayload(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

export async function findIdempotencyRecord(userId: string, key: string) {
  const record = await prisma.apiIdempotencyRecord.findUnique({
    where: {
      userId_key: { userId, key },
    },
  });

  if (!record) return null;
  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.apiIdempotencyRecord.delete({ where: { id: record.id } }).catch(() => undefined);
    return null;
  }

  return record;
}

export async function saveIdempotencyRecord(input: {
  userId: string;
  key: string;
  requestHash: string;
  statusCode: number;
  responseJson: string;
}) {
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);
  try {
    return await prisma.apiIdempotencyRecord.create({
      data: {
        userId: input.userId,
        key: input.key,
        requestHash: input.requestHash,
        statusCode: input.statusCode,
        responseJson: input.responseJson,
        expiresAt,
      },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'P2002') {
      throw error;
    }
    return findIdempotencyRecord(input.userId, input.key);
  }
}

export async function completeIdempotencyRecord(input: {
  userId: string;
  key: string;
  statusCode: number;
  responseJson: string;
}) {
  await prisma.apiIdempotencyRecord.update({
    where: {
      userId_key: { userId: input.userId, key: input.key },
    },
    data: {
      statusCode: input.statusCode,
      responseJson: input.responseJson,
    },
  });
}

export async function releaseIdempotencyRecord(userId: string, key: string) {
  await prisma.apiIdempotencyRecord.deleteMany({
    where: { userId, key },
  });
}
