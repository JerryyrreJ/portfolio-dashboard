import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/ownership';
import { resolveOwnedPortfolioIds } from '@/lib/owned-portfolios';
import { isDateOnlyAfter, toDateOnlyString } from '@/lib/pending-dividends';

/**
 * GET /api/transactions/dividends/stats
 * 获取分红统计信息，用于显示通知徽章
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const portfolioId = searchParams.get('portfolioId');
    const pids = searchParams.get('pids');

    const ownedPortfolios = await resolveOwnedPortfolioIds(user.id, { portfolioId, pids });
    if (ownedPortfolios.length === 0) {
      return NextResponse.json(
        { error: portfolioId || pids ? 'Portfolio not found' : 'Missing portfolioId or pids parameter' },
        { status: portfolioId || pids ? 404 : 400 }
      );
    }
    const portfolioIds = ownedPortfolios.map((portfolio) => portfolio.id);
    const portfolioNameById = new Map(ownedPortfolios.map((portfolio) => [portfolio.id, portfolio.name]));

    // 统计待确认的分红数量
    const pendingCount = await prisma.pendingDividend.count({
      where: {
        portfolioId: { in: portfolioIds },
        status: 'pending',
      },
    });

    // 计算待确认分红的总金额
    const pendingDividends = await prisma.pendingDividend.findMany({
      where: {
        portfolioId: { in: portfolioIds },
        status: 'pending',
      },
      select: {
        portfolioId: true,
        calculatedAmount: true,
        currency: true,
        payDate: true,
      },
    });

    const today = toDateOnlyString(new Date())!;

    // 按货币分组，避免跨货币直接求和产生无意义数字
    const amountByCurrency: Record<string, number> = {};
    const pendingCountByPortfolio: Record<string, { count: number; name: string }> = {};
    // pay date 还未到账的数量（已过 ex-date 但现金未到账）
    let payDatePendingCount = 0;
    for (const d of pendingDividends) {
      amountByCurrency[d.currency] = (amountByCurrency[d.currency] ?? 0) + d.calculatedAmount;
      pendingCountByPortfolio[d.portfolioId] = {
        count: (pendingCountByPortfolio[d.portfolioId]?.count ?? 0) + 1,
        name: portfolioNameById.get(d.portfolioId) || d.portfolioId,
      };
      if (d.payDate && isDateOnlyAfter(d.payDate, today)) payDatePendingCount++;
    }

    return NextResponse.json({
      success: true,
      pendingCount,
      amountByCurrency,
      pendingCountByPortfolio,
      payDatePendingCount,
      hasPending: pendingCount > 0,
    });

  } catch (error) {
    console.error('Failed to fetch dividend stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dividend stats' },
      { status: 500 }
    );
  }
}
