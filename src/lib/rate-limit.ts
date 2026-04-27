import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

type RateLimitConfig = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type RateLimitHeaders = Record<string, string>;

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown';
}

function buildHeaders(limit: number, remaining: number, resetAt: number): RateLimitHeaders {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
    'Retry-After': String(retryAfterSeconds),
  };
}

export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ allowed: boolean; headers: RateLimitHeaders }> {
  const now = Date.now();
  const clientIp = getClientIp(request);
  const key = `${config.keyPrefix}:${clientIp}`;
  const nowDate = new Date(now);

  try {
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimitCounter.findUnique({
        where: { key },
        select: { key: true, count: true, resetAt: true },
      });

      if (!existing || existing.resetAt.getTime() <= now) {
        const resetAt = new Date(now + config.windowMs);
        return tx.rateLimitCounter.upsert({
          where: { key },
          create: {
            key,
            count: 1,
            resetAt,
          },
          update: {
            count: 1,
            resetAt,
          },
          select: {
            count: true,
            resetAt: true,
          },
        });
      }

      return tx.rateLimitCounter.update({
        where: { key },
        data: { count: { increment: 1 } },
        select: {
          count: true,
          resetAt: true,
        },
      });
    });

    const remaining = config.limit - record.count;
    return {
      allowed: record.count <= config.limit,
      headers: buildHeaders(config.limit, remaining, record.resetAt.getTime()),
    };
  } catch (error) {
    // Fallback: fail-open to avoid blocking critical API flows when DB is transiently unavailable.
    const resetAt = nowDate.getTime() + config.windowMs;
    return {
      allowed: true,
      headers: buildHeaders(config.limit, config.limit - 1, resetAt),
    };
  }
}
