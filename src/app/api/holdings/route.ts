import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/ownership';

// 计算投资组合的当前持仓
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
        { error: 'Portfolio ID is required' },
        { status: 400 }
      );
    }

    // 获取投资组合的所有交易
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: user.id,
      },
      include: {
        transactions: {
          include: {
            asset: true,
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    if (!portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // 计算持仓
    const holdingsMap = new Map<string, {
      assetId: string;
      ticker: string;
      name: string;
      market: string;
      quantity: number;
      totalCost: number;
      avgCost: number;
    }>();

    for (const t of portfolio.transactions) {
      const ticker = t.asset.ticker;

      if (!holdingsMap.has(ticker)) {
        holdingsMap.set(ticker, {
          assetId: t.asset.id,
          ticker: t.asset.ticker,
          name: t.asset.name,
          market: t.asset.market,
          quantity: 0,
          totalCost: 0,
          avgCost: 0,
        });
      }

      const current = holdingsMap.get(ticker)!;

      if (t.type === 'BUY') {
        current.quantity += t.quantity;
        current.totalCost += (t.price * t.quantity) + t.fee;
      } else if (t.type === 'SELL') {
        const avgCost = current.quantity > 0 ? current.totalCost / current.quantity : 0;
        current.quantity -= t.quantity;
        current.totalCost -= avgCost * t.quantity;
        if (current.quantity <= 0) {
          current.quantity = 0;
          current.totalCost = 0;
        }
      }

      // 重新计算平均成本
      if (current.quantity > 0) {
        current.avgCost = current.totalCost / current.quantity;
      } else {
        current.avgCost = 0;
        current.totalCost = 0;
      }
    }

    // 只返回有持仓的股票
    const holdings = Array.from(holdingsMap.values())
      .filter(h => h.quantity > 0)
      .map(h => ({
        assetId: h.assetId,
        ticker: h.ticker,
        name: h.name,
        market: h.market,
        quantity: h.quantity,
        avgCost: h.avgCost,
        totalCost: h.totalCost,
      }));

    return NextResponse.json({
      holdings,
      count: holdings.length,
    });

  } catch (error) {
    console.error('Failed to fetch holdings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch holdings' },
      { status: 500 }
    );
  }
}
