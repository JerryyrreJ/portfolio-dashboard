import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { toPublicApiKey } from '@/lib/api/auth';
import { normalizeApiKeyName } from '@/lib/api/keys';
import prisma from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/ownership';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function findOwnedApiKey(userId: string, id: string) {
  return prisma.apiKey.findFirst({
    where: {
      id,
      userId,
      revokedAt: null,
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Sign in to manage API keys.');
  }

  const { id } = await context.params;
  const existing = await findOwnedApiKey(user.id, id);
  if (!existing) {
    return apiError(404, 'API_KEY_NOT_FOUND', 'API key not found.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'INVALID_BODY', 'Request body must be JSON.');
  }

  const name = normalizeApiKeyName(
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>).name : undefined,
    existing.name
  );
  if (name === null) {
    return apiError(400, 'VALIDATION_ERROR', 'name must be a string of at most 80 characters.', [
      { field: 'name', code: 'INVALID_NAME', message: 'name must be a string of at most 80 characters.' },
    ]);
  }

  const updated = await prisma.apiKey.update({
    where: { id: existing.id },
    data: { name },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastFour: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json({ key: toPublicApiKey(updated) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Sign in to manage API keys.');
  }

  const { id } = await context.params;
  const existing = await findOwnedApiKey(user.id, id);
  if (!existing) {
    return apiError(404, 'API_KEY_NOT_FOUND', 'API key not found.');
  }

  await prisma.apiKey.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
