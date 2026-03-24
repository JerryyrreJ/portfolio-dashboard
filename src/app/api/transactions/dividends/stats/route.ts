import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findOwnedPortfolio, requireAuthenticatedUser } from '@/lib/ownership';

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

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Missing portfolioId parameter' },
        { status: 400 }
      );
    }

    const portfolio = await findOwnedPortfolio(user.id, portfolioId);
    if (!portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // 统计待确认的分红数量
    const pendingCount = await prisma.pendingDividend.count({
      where: {
        portfolioId,
        status: 'pending',
      },
    });

    // 计算待确认分红的总金额
    const pendingDividends = await prisma.pendingDividend.findMany({
      where: {
        portfolioId,
        status: 'pending',
      },
      select: {
        calculatedAmount: true,
        currency: true,
      },
    });

    const totalAmount = pendingDividends.reduce((sum, d) => sum + d.calculatedAmount, 0);

    return NextResponse.json({
      success: true,
      pendingCount,
      totalAmount,
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
