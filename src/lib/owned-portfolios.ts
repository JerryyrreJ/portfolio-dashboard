import prisma from '@/lib/prisma';
import { parsePortfolioIdList } from '@/lib/portfolio-selection';

export async function resolveOwnedPortfolioIds(
  userId: string,
  options: { portfolioId?: string | null; portfolioIds?: string[] | null; pids?: string | null },
) {
  const requestedIds = new Set<string>();

  if (options.portfolioId?.trim()) {
    requestedIds.add(options.portfolioId.trim());
  }

  if (Array.isArray(options.portfolioIds)) {
    for (const id of options.portfolioIds) {
      if (typeof id === 'string' && id.trim()) {
        requestedIds.add(id.trim());
      }
    }
  }

  if (options.pids) {
    for (const id of parsePortfolioIdList(options.pids)) {
      requestedIds.add(id);
    }
  }

  const normalizedRequestedIds = Array.from(requestedIds);
  if (normalizedRequestedIds.length === 0) {
    return [];
  }

  const ownedPortfolios = await prisma.portfolio.findMany({
    where: {
      userId,
      id: { in: normalizedRequestedIds },
    },
    select: {
      id: true,
      name: true,
      lastDividendSyncAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return ownedPortfolios;
}
