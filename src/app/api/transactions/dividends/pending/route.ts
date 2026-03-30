import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findOwnedPortfolio, requireAuthenticatedUser } from '@/lib/ownership';

/**
 * GET /api/transactions/dividends/pending
 * 返回当前用户所有已过除权日但尚未确认的分红
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

    // 获取所有待确认的分红
    const pendingDividends = await prisma.pendingDividend.findMany({
      where: {
        portfolioId,
        status: 'pending',
      },
      orderBy: {
        exDate: 'desc',
      },
    });

    if (pendingDividends.length === 0) {
      return NextResponse.json({
        success: true,
        dividends: [],
      });
    }

    // 获取对应的 Asset 信息（名称、Logo 等）
    const tickers = [...new Set(pendingDividends.map(d => d.ticker))];
    const assets = await prisma.asset.findMany({
      where: {
        ticker: { in: tickers },
      },
      select: {
        ticker: true,
        name: true,
        logo: true,
      },
    });

    const assetMap = new Map(assets.map(a => [a.ticker, a]));

    const result = pendingDividends.map(d => {
      const asset = assetMap.get(d.ticker);
      return {
        id: d.id,
        ticker: d.ticker,
        name: asset?.name || d.ticker,
        logo: asset?.logo,
        exDate: d.exDate,
        payDate: d.payDate,
        sharesHeld: d.sharesHeld,
        dividendPerShare: d.dividendPerShare,
        calculatedAmount: d.calculatedAmount,
        currency: d.currency,
        status: d.status,
      };
    });

    return NextResponse.json({
      success: true,
      dividends: result,
    });

  } catch (error) {
    console.error('Failed to fetch pending dividends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending dividends' },
      { status: 500 }
    );
  }
}
