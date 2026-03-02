import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 计算投资组合的当前持仓
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const portfolioId = searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Portfolio ID is required' },
        { status: 400 }
      );
    }

    // 获取投资组合的所有交易
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
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
        current.quantity += t.quantity; // SELL 的 quantity 已经是负数
        // 按比例扣除成本
        if (current.quantity + Math.abs(t.quantity) > 0) {
          const ratio = Math.abs(t.quantity) / (current.quantity + Math.abs(t.quantity));
          current.totalCost -= current.totalCost * ratio;
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
