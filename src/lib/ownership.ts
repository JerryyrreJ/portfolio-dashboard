import type { Portfolio } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

export async function requireAuthenticatedUser() {
  return getUser();
}

export async function findOwnedPortfolio(
  userId: string,
  portfolioId: string
): Promise<Portfolio | null> {
  return prisma.portfolio.findFirst({
    where: {
      id: portfolioId,
      userId,
    },
  });
}

export async function findOwnedTransaction(userId: string, transactionId: string) {
  return prisma.transaction.findFirst({
    where: {
      id: transactionId,
      portfolio: {
        userId,
      },
    },
  });
}

export async function getOwnedPortfolioIds(userId: string) {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    select: { id: true },
  });

  return portfolios.map((portfolio) => portfolio.id);
}

export async function findOwnedPendingDividends(userId: string, ids: string[]) {
  const portfolioIds = await getOwnedPortfolioIds(userId);
  if (portfolioIds.length === 0 || ids.length === 0) {
    return [];
  }

  return prisma.pendingDividend.findMany({
    where: {
      id: { in: ids },
      portfolioId: { in: portfolioIds },
    },
  });
}
