import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

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

export type ImportIdempotency = { userId: string; key: string; requestHash: string };

export class IdempotencyConflict extends Error {
  constructor(public readonly code: 'IDEMPOTENCY_IN_PROGRESS' | 'IDEMPOTENCY_KEY_REUSED') {
    super(code === 'IDEMPOTENCY_IN_PROGRESS'
      ? 'A request with this Idempotency-Key is already in progress. Retry shortly.'
      : 'Idempotency-Key was already used with a different request body.');
  }
}

/** The lock, trade writes and replay response share one PostgreSQL transaction. */
export async function runIdempotentImport<T>(
  identity: ImportIdempotency | null,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<{ payload: T; statusCode: number; replayed: boolean }> {
  return prisma.$transaction(async (tx) => {
    if (identity) {
      // A transaction-scoped, nonblocking lock serializes the user/key pair across
      // processes. Parameterized SQL; no session lock leaks through pooled connections.
      const lockKey = JSON.stringify([identity.userId, identity.key]);
      const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${lockKey}, 0)) AS acquired
      `;
      if (!lock?.acquired) throw new IdempotencyConflict('IDEMPOTENCY_IN_PROGRESS');

      const where = { userId_key: { userId: identity.userId, key: identity.key } };
      const existing = await tx.apiIdempotencyRecord.findUnique({ where });
      if (existing && existing.expiresAt.getTime() > Date.now()) {
        if (existing.requestHash !== identity.requestHash) {
          throw new IdempotencyConflict('IDEMPOTENCY_KEY_REUSED');
        }
        // Support pending records left by the previous implementation without stealing them.
        if (existing.statusCode === 202) throw new IdempotencyConflict('IDEMPOTENCY_IN_PROGRESS');
        return {
          payload: JSON.parse(existing.responseJson) as T,
          statusCode: existing.statusCode,
          replayed: true,
        };
      }
      if (existing) await tx.apiIdempotencyRecord.delete({ where: { id: existing.id } });
    }

    const payload = await operation(tx);
    if (identity) {
      await tx.apiIdempotencyRecord.create({
        data: {
          ...identity,
          statusCode: 200,
          responseJson: JSON.stringify(payload),
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        },
      });
    }
    // A failed response write rolls back the trades too. A lost HTTP response after
    // commit is safe: the next request reads the committed replay record.
    return { payload, statusCode: 200, replayed: false };
  }, { timeout: 15_000, isolationLevel: 'ReadCommitted' });
}
