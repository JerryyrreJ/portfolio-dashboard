import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getDividends as getAlphaVantageDividends,
  getDividendProviderState as getAlphaVantageDividendProviderState,
} from '@/lib/alphavantage';
import {
  getDividends as getTwelveDataDividends,
  getDividendProviderSupportStatus as getTwelveDataDividendSupportStatus,
} from '@/lib/twelvedata';
import {
  getDividends as getFinnhubDividends,
  getDividendProviderSupportStatus as getFinnhubDividendSupportStatus,
} from '@/lib/finnhub';
import { requireAuthenticatedUser } from '@/lib/ownership';
import { resolveOwnedPortfolioIds } from '@/lib/owned-portfolios';
import {
  isPendingDividendPending,
  PENDING_DIVIDEND_STATUS_PENDING,
  toDateOnlyString,
} from '@/lib/pending-dividends';

const AUTO_SYNC_THROTTLE_MS = 6 * 60 * 60 * 1000;

type UnifiedDividend = {
  symbol: string;
  ex_date: string;
  payment_date?: string;
  amount: number;
  currency?: string;
};

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

async function fetchTickerDividends(
  ticker: string,
  startDate: string,
  endDate: string,
  support: {
    skipAlphaVantage: boolean;
    skipTwelveData: boolean;
    skipFinnhub: boolean;
  },
) {
  let dividends: UnifiedDividend[] = [];
  let providerSucceeded = false;
  let { skipAlphaVantage, skipTwelveData, skipFinnhub } = support;

  if (!skipAlphaVantage) {
    const result = await getAlphaVantageDividends(ticker, startDate, endDate);
    if (getAlphaVantageDividendProviderState() === 'rate_limited') {
      skipAlphaVantage = true;
    }
    if (result.ok) {
      providerSucceeded = true;
      dividends = result.data;
    }
  }

  if (!providerSucceeded && !skipTwelveData) {
    const result = await getTwelveDataDividends(ticker, startDate, endDate);
    if (getTwelveDataDividendSupportStatus() === 'unsupported') {
      skipTwelveData = true;
    }
    if (result.ok) {
      providerSucceeded = true;
      dividends = result.data;
    }
  }

  if (!providerSucceeded && !skipFinnhub) {
    const result = await getFinnhubDividends(ticker, startDate, endDate);
    if (getFinnhubDividendSupportStatus() === 'unsupported') {
      skipFinnhub = true;
    }
    if (result.ok) {
      dividends = result.data.map((d) => ({
        symbol: d.symbol,
        ex_date: d.date,
        payment_date: d.payDate,
        amount: d.amount,
        currency: d.currency || 'USD',
      }));
    }
  }

  return {
    dividends,
    support: {
      skipAlphaVantage,
      skipTwelveData,
      skipFinnhub,
    },
  };
}

/**
 * POST /api/transactions/dividends/sync
 * 支持单个或多个 portfolio 的分红同步。
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { force, portfolioId, portfolioIds } = body;
    const ownedPortfolios = await resolveOwnedPortfolioIds(user.id, {
      portfolioId,
      portfolioIds: Array.isArray(portfolioIds) ? portfolioIds : null,
    });

    if (ownedPortfolios.length === 0) {
      return NextResponse.json(
        { error: portfolioId || (Array.isArray(portfolioIds) && portfolioIds.length > 0) ? 'Portfolio not found' : 'Missing portfolioId or portfolioIds parameter' },
        { status: portfolioId || (Array.isArray(portfolioIds) && portfolioIds.length > 0) ? 404 : 400 }
      );
    }

    const now = new Date();
    const today = new Date();
    const todayStr = toDateString(today);
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(today.getMonth() + 1);
    const endDate = toDateString(oneMonthLater);

    const syncResults: Array<{
      portfolioId: string;
      portfolioName: string;
      skipped: boolean;
      synced: number;
      message: string;
    }> = [];
    let totalSynced = 0;

    let providerSupport = {
      skipAlphaVantage: getAlphaVantageDividendProviderState() === 'rate_limited',
      skipTwelveData: getTwelveDataDividendSupportStatus() === 'unsupported',
      skipFinnhub: getFinnhubDividendSupportStatus() === 'unsupported',
    };

    for (const portfolio of ownedPortfolios) {
      const lastDividendSyncAt = portfolio.lastDividendSyncAt
        ? new Date(portfolio.lastDividendSyncAt)
        : null;
      const isThrottled =
        !force &&
        lastDividendSyncAt !== null &&
        now.getTime() - lastDividendSyncAt.getTime() < AUTO_SYNC_THROTTLE_MS;

      if (isThrottled) {
        syncResults.push({
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          skipped: true,
          synced: 0,
          message: 'Dividend sync throttled',
        });
        continue;
      }

      const transactions = await prisma.transaction.findMany({
        where: {
          portfolioId: portfolio.id,
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
          where: { id: portfolio.id },
          data: { lastDividendSyncAt: now },
        });
        syncResults.push({
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          skipped: false,
          synced: 0,
          message: 'No holdings history to sync',
        });
        continue;
      }

      const existingDividends = await prisma.pendingDividend.findMany({
        where: {
          portfolioId: portfolio.id,
          ticker: { in: candidateTickers },
        },
        select: {
          id: true,
          ticker: true,
          exDate: true,
          sourceKey: true,
          status: true,
        },
      });

      const latestKnownExDateByTicker = new Map<string, Date>();
      const existingDividendByIdentity = new Map<
        string,
        { id: string; status: string }
      >();

      for (const dividend of existingDividends) {
        const currentLatestExDate = latestKnownExDateByTicker.get(dividend.ticker);
        if (!currentLatestExDate || dividend.exDate > currentLatestExDate) {
          latestKnownExDateByTicker.set(dividend.ticker, dividend.exDate);
        }

        existingDividendByIdentity.set(
          `${dividend.ticker}::${toDateOnlyString(dividend.exDate)}::${dividend.sourceKey}`,
          {
            id: dividend.id,
            status: dividend.status,
          }
        );
      }

      let syncedCount = 0;

      for (const ticker of candidateTickers) {
        try {
          const tickerTransactions = transactionsByTicker.get(ticker) || [];
          const earliestTradeDate = new Date(tickerTransactions[0].date);
          const latestKnownExDate = latestKnownExDateByTicker.get(ticker);
          const startDate = toDateString(
            getTickerSyncStartDate(earliestTradeDate, latestKnownExDate)
          );

          const response = await fetchTickerDividends(
            ticker,
            startDate,
            endDate,
            providerSupport,
          );
          providerSupport = response.support;

          for (const dividend of response.dividends) {
            const exDateStr = toDateOnlyString(dividend.ex_date);
            if (!exDateStr || exDateStr > todayStr) continue;

            let sharesOnExDate = 0;
            for (const tx of tickerTransactions) {
              if ((toDateOnlyString(tx.date) ?? '') >= exDateStr) break;
              if (tx.type === 'BUY') sharesOnExDate += tx.quantity;
              else if (tx.type === 'SELL') sharesOnExDate -= tx.quantity;
            }

            if (sharesOnExDate <= 0) continue;

            const calculatedAmount = sharesOnExDate * dividend.amount;
            const sourceKey = buildDividendSourceKey(dividend);
            const exDate = new Date(`${exDateStr}T00:00:00.000Z`);
            const payDateString = toDateOnlyString(dividend.payment_date);
            const payDate = payDateString
              ? new Date(`${payDateString}T00:00:00.000Z`)
              : null;
            const identityKey = `${ticker}::${exDateStr}::${sourceKey}`;
            const existing = existingDividendByIdentity.get(identityKey);

            if (existing && !isPendingDividendPending(existing.status)) {
              continue;
            }

            await prisma.pendingDividend.upsert({
              where: {
                portfolioId_ticker_exDate_sourceKey: {
                  portfolioId: portfolio.id,
                  ticker,
                  exDate,
                  sourceKey,
                },
              },
              update: {
                sharesHeld: sharesOnExDate,
                dividendPerShare: dividend.amount,
                calculatedAmount,
                payDate,
                currency: dividend.currency || 'USD',
              },
              create: {
                portfolioId: portfolio.id,
                ticker,
                exDate,
                payDate,
                sharesHeld: sharesOnExDate,
                dividendPerShare: dividend.amount,
                calculatedAmount,
                currency: dividend.currency || 'USD',
                sourceKey,
                status: PENDING_DIVIDEND_STATUS_PENDING,
              },
            });

            if (!existing) {
              syncedCount += 1;
              existingDividendByIdentity.set(identityKey, {
                id: '',
                status: PENDING_DIVIDEND_STATUS_PENDING,
              });
            }
          }
        } catch (error) {
          console.error(`Failed to sync dividends for ${ticker}:`, error);
        }
      }

      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: { lastDividendSyncAt: now },
      });

      totalSynced += syncedCount;
      syncResults.push({
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        skipped: false,
        synced: syncedCount,
        message: `Synced dividends for ${candidateTickers.length} holdings`,
      });
    }

    return NextResponse.json({
      success: true,
      totalSynced,
      results: syncResults,
    });
  } catch (error) {
    console.error('Failed to sync dividends:', error);
    return NextResponse.json(
      { error: 'Failed to sync dividends' },
      { status: 500 }
    );
  }
}
