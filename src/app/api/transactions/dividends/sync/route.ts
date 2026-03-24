import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDividends as getTwelveDataDividends } from '@/lib/twelvedata';
import { getDividends as getFinnhubDividends } from '@/lib/finnhub';
import { findOwnedPortfolio, requireAuthenticatedUser } from '@/lib/ownership';

/**
 * POST /api/transactions/dividends/sync
 * 同步指定 portfolio 的分红数据
 *
 * 逻辑：
 * 1. 获取该 portfolio 的所有持仓股票
 * 2. 对每只股票，查询过去 3 个月的分红公告
 * 3. 对于已过除权日的分红，计算用户在除权日的持仓数量
 * 4. 创建或更新 PendingDividend 记录
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { portfolioId } = body;

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

    // 1. 获取该 portfolio 的所有交易记录，计算当前持仓
    const transactions = await prisma.transaction.findMany({
      where: { portfolioId },
      include: { asset: true },
      orderBy: { date: 'asc' },
    });

    // 计算每只股票的持仓
    const holdings = new Map<string, { ticker: string; quantity: number; assetId: string }>();

    for (const tx of transactions) {
      const ticker = tx.asset.ticker;
      const current = holdings.get(ticker) || { ticker, quantity: 0, assetId: tx.assetId };

      if (tx.type === 'BUY') {
        current.quantity += tx.quantity;
      } else if (tx.type === 'SELL') {
        current.quantity -= tx.quantity;
      }

      holdings.set(ticker, current);
    }

    // 过滤掉持仓为 0 的股票
    const activeHoldings = Array.from(holdings.values()).filter(h => h.quantity > 0);

    if (activeHoldings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active holdings to sync',
        synced: 0,
      });
    }

    // 2. 查询过去 3 个月到未来 1 个月的分红数据
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(today.getMonth() + 1);

    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = oneMonthLater.toISOString().split('T')[0];

    let syncedCount = 0;

    for (const holding of activeHoldings) {
      try {
        // 优先使用 TwelveData
        let dividends = await getTwelveDataDividends(holding.ticker, startDate, endDate);

        // Fallback to Finnhub
        if (!dividends || dividends.length === 0) {
          const finnhubDividends = await getFinnhubDividends(holding.ticker, startDate, endDate);
          dividends = finnhubDividends.map(d => ({
            symbol: d.symbol,
            ex_date: d.date,
            payment_date: d.payDate,
            amount: d.amount,
            currency: d.currency || 'USD',
          }));
        }

        if (!dividends || dividends.length === 0) {
          continue;
        }

        // 3. 对于已过除权日的分红，计算持仓并创建 PendingDividend
        for (const dividend of dividends) {
          const exDate = new Date(dividend.ex_date);

          // 只处理已过除权日的分红
          if (exDate > today) {
            continue;
          }

          // 计算除权日当天的持仓数量
          let sharesOnExDate = 0;
          for (const tx of transactions) {
            if (tx.asset.ticker !== holding.ticker) continue;
            if (new Date(tx.date) > exDate) break;

            if (tx.type === 'BUY') {
              sharesOnExDate += tx.quantity;
            } else if (tx.type === 'SELL') {
              sharesOnExDate -= tx.quantity;
            }
          }

          if (sharesOnExDate <= 0) {
            continue;
          }

          // 计算分红金额
          const calculatedAmount = sharesOnExDate * dividend.amount;

          // 创建或更新 PendingDividend（使用 upsert 避免重复）
          await prisma.pendingDividend.upsert({
            where: {
              portfolioId_ticker_exDate: {
                portfolioId,
                ticker: holding.ticker,
                exDate,
              },
            },
            update: {
              sharesHeld: sharesOnExDate,
              dividendPerShare: dividend.amount,
              calculatedAmount,
              payDate: dividend.payment_date ? new Date(dividend.payment_date) : null,
              currency: dividend.currency || 'USD',
            },
            create: {
              portfolioId,
              ticker: holding.ticker,
              exDate,
              payDate: dividend.payment_date ? new Date(dividend.payment_date) : null,
              sharesHeld: sharesOnExDate,
              dividendPerShare: dividend.amount,
              calculatedAmount,
              currency: dividend.currency || 'USD',
              status: 'pending',
            },
          });

          syncedCount++;
        }
      } catch (error) {
        console.error(`Failed to sync dividends for ${holding.ticker}:`, error);
        // 继续处理其他股票
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced dividends for ${activeHoldings.length} holdings`,
      synced: syncedCount,
    });

  } catch (error) {
    console.error('Failed to sync dividends:', error);
    return NextResponse.json(
      { error: 'Failed to sync dividends' },
      { status: 500 }
    );
  }
}
