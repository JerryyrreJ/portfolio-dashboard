import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDividends as getAlphaVantageDividends } from '@/lib/alphavantage';
import { getDividends as getTwelveDataDividends } from '@/lib/twelvedata';
import { getDividends as getFinnhubDividends } from '@/lib/finnhub';
import { findOwnedPortfolio, requireAuthenticatedUser } from '@/lib/ownership';

const AUTO_SYNC_THROTTLE_MS = 6 * 60 * 60 * 1000;

function buildDividendSourceKey(dividend: {
  payment_date?: string | null;
  amount: number;
  currency?: string | null;
}) {
  const payDate = dividend.payment_date ?? '';
  const currency = dividend.currency || 'USD';
  const scaledAmount = Math.round(Number(dividend.amount) * 100000000);
  return `${payDate}:${currency}:${scaledAmount}`;
}

function toDateString(date: Date) {
  return date.toISOString().split('T')[0];
}

function getTickerSyncStartDate(
  earliestTradeDate: Date,
  latestKnownExDate?: Date
) {
  if (!latestKnownExDate) {
    return earliestTradeDate;
  }

  const incrementalStartDate = new Date(latestKnownExDate);
  incrementalStartDate.setDate(incrementalStartDate.getDate() - 31);

  return incrementalStartDate > earliestTradeDate
    ? incrementalStartDate
    : earliestTradeDate;
}

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
    const { force, portfolioId } = body;

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

    const now = new Date();
    const lastDividendSyncAt = portfolio.lastDividendSyncAt
      ? new Date(portfolio.lastDividendSyncAt)
      : null;
    const isThrottled =
      !force &&
      lastDividendSyncAt !== null &&
      now.getTime() - lastDividendSyncAt.getTime() < AUTO_SYNC_THROTTLE_MS;

    if (isThrottled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Dividend sync throttled',
        synced: 0,
      });
    }

    // 1. 获取该 portfolio 的所有交易记录，计算当前持仓
    const transactions = await prisma.transaction.findMany({
      where: {
        portfolioId,
        type: { in: ['BUY', 'SELL'] },
      },
      include: { asset: true },
      orderBy: { date: 'asc' },
    });

    const transactionsByTicker = new Map<string, typeof transactions>();

    for (const tx of transactions) {
      const ticker = tx.asset.ticker;
      const tickerTransactions = transactionsByTicker.get(ticker) || [];
      tickerTransactions.push(tx);
      transactionsByTicker.set(ticker, tickerTransactions);
    }

    const candidateTickers = Array.from(transactionsByTicker.keys());

    if (candidateTickers.length === 0) {
      await prisma.portfolio.update({
        where: { id: portfolioId },
        data: { lastDividendSyncAt: now },
      });

      return NextResponse.json({
        success: true,
        message: 'No holdings history to sync',
        synced: 0,
      });
    }

    const existingDividends = await prisma.pendingDividend.findMany({
      where: {
        portfolioId,
        ticker: { in: candidateTickers },
      },
      select: {
        ticker: true,
        exDate: true,
      },
    });

    const latestKnownExDateByTicker = new Map<string, Date>();
    for (const dividend of existingDividends) {
      const currentLatestExDate = latestKnownExDateByTicker.get(dividend.ticker);
      if (!currentLatestExDate || dividend.exDate > currentLatestExDate) {
        latestKnownExDateByTicker.set(dividend.ticker, dividend.exDate);
      }
    }

    // 2. 查询从首次持仓或上次已知股息附近开始，到未来 1 个月的分红数据
    const today = new Date();
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(today.getMonth() + 1);
    const endDate = toDateString(oneMonthLater);

    let syncedCount = 0;

    for (const ticker of candidateTickers) {
      try {
        const tickerTransactions = transactionsByTicker.get(ticker) || [];
        const earliestTradeDate = new Date(tickerTransactions[0].date);
        const latestKnownExDate = latestKnownExDateByTicker.get(ticker);
        const startDate = toDateString(
          getTickerSyncStartDate(earliestTradeDate, latestKnownExDate)
        );

        // 优先使用 Alpha Vantage
        let dividends = await getAlphaVantageDividends(ticker, startDate, endDate);

        // Fallback to TwelveData
        if (!dividends || dividends.length === 0) {
          dividends = await getTwelveDataDividends(ticker, startDate, endDate);
        }

        // Fallback to Finnhub
        if (!dividends || dividends.length === 0) {
          const finnhubDividends = await getFinnhubDividends(ticker, startDate, endDate);
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
          for (const tx of tickerTransactions) {
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
          const sourceKey = buildDividendSourceKey(dividend);

          // 创建或更新 PendingDividend（使用 upsert 避免重复）
          await prisma.pendingDividend.upsert({
            where: {
              portfolioId_ticker_exDate_sourceKey: {
                portfolioId,
                ticker,
                exDate,
                sourceKey,
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
              ticker,
              exDate,
              payDate: dividend.payment_date ? new Date(dividend.payment_date) : null,
              sharesHeld: sharesOnExDate,
              dividendPerShare: dividend.amount,
              calculatedAmount,
              currency: dividend.currency || 'USD',
              sourceKey,
              status: 'pending',
            },
          });

          syncedCount++;
        }
      } catch (error) {
        console.error(`Failed to sync dividends for ${ticker}:`, error);
        // 继续处理其他股票
      }
    }

    await prisma.portfolio.update({
      where: { id: portfolioId },
      data: { lastDividendSyncAt: now },
    });

    return NextResponse.json({
      success: true,
      message: `Synced dividends for ${candidateTickers.length} holdings`,
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
