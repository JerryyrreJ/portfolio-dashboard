import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getPriceUSD } from '@/lib/exchange-rate';
import {
  findOwnedPendingDividends,
  requireAuthenticatedUser,
} from '@/lib/ownership';

function parseDividendAmount(rawAmount: unknown) {
  const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

function parseReinvestPrice(rawPrice: unknown) {
  const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return price;
}

function parseReinvestDate(rawDate: unknown) {
  if (typeof rawDate !== 'string' || !rawDate.trim()) {
    return null;
  }

  const parsed = new Date(`${rawDate}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * POST /api/transactions/dividends/confirm
 * 确认分红并创建 DIVIDEND 类型的 Transaction
 *
 * Body: { id: string, finalAmount?: number } 或 { ids: string[], adjustments?: { [id: string]: number } }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // 支持单个确认或批量确认
    const requestedIds: string[] = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string')
      : typeof body.id === 'string'
        ? [body.id]
        : [];
    const ids = Array.from(new Set<string>(requestedIds));
    const adjustments = body.adjustments || {};
    const finalAmount = body.finalAmount; // 单个确认时的金额调整
    const requestedMode = body.mode === 'reinvest' ? 'reinvest' : 'cash';
    const reinvestPrice = parseReinvestPrice(body.reinvestPrice);
    const reinvestDate = parseReinvestDate(body.reinvestDate);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing id or ids parameter' },
        { status: 400 }
      );
    }

    if (requestedMode === 'reinvest') {
      if (ids.length !== 1) {
        return NextResponse.json(
          { error: 'Dividend reinvestment only supports confirming one dividend at a time' },
          { status: 400 }
        );
      }

      if (reinvestPrice === null) {
        return NextResponse.json(
          { error: 'Missing or invalid reinvestPrice' },
          { status: 400 }
        );
      }
    }

    // 获取待确认的分红记录
    const ownedPendingDividends = await findOwnedPendingDividends(user.id, ids);
    const pendingDividends = ownedPendingDividends.filter(
      (dividend) => dividend.status === 'pending'
    );

    if (pendingDividends.length !== ids.length) {
      return NextResponse.json(
        { error: 'Pending dividends not found' },
        { status: 404 }
      );
    }

    const normalizedDividends = await Promise.all(
      pendingDividends.map(async (dividend) => {
        const requestedAmount =
          ids.length === 1 && finalAmount !== undefined
            ? finalAmount
            : adjustments[dividend.id] !== undefined
              ? adjustments[dividend.id]
              : dividend.calculatedAmount;
        const amount = parseDividendAmount(requestedAmount);

        if (amount === null) {
          throw new Error('Invalid dividend amount');
        }

        const fx = await getPriceUSD(amount, dividend.currency);
        return {
          dividend,
          amount,
          mode: requestedMode,
          reinvestPrice,
          reinvestDate,
          ...fx,
        };
      })
    );

    // 在进入 DB transaction 前预先验证所有 ticker 对应的 asset 存在，避免事务中途失败
    const uniqueTickers = [...new Set(normalizedDividends.map(d => d.dividend.ticker))];
    const assets = await prisma.asset.findMany({
      where: { ticker: { in: uniqueTickers } },
      select: { id: true, ticker: true, currency: true },
    });
    const assetByTicker = new Map(assets.map(a => [a.ticker, a]));
    const missingTicker = uniqueTickers.find(t => !assetByTicker.has(t));
    if (missingTicker) {
      return NextResponse.json(
        { error: `Asset not found for ticker: ${missingTicker}` },
        { status: 404 }
      );
    }

    const results = await prisma.$transaction(async (tx) => {
      const confirmedResults = [];

      for (const { dividend, amount, priceUSD, exchangeRate, mode, reinvestPrice: normalizedReinvestPrice, reinvestDate: normalizedReinvestDate } of normalizedDividends) {
        const asset = assetByTicker.get(dividend.ticker)!;
        const eventId = mode === 'reinvest' ? randomUUID() : null;

        const statusUpdate = await tx.pendingDividend.updateMany({
          where: {
            id: dividend.id,
            status: 'pending',
          },
          data: { status: 'confirmed' },
        });

        if (statusUpdate.count !== 1) {
          throw new Error(`Pending dividend not found for id: ${dividend.id}`);
        }

        const transaction = await tx.transaction.create({
          data: {
            portfolioId: dividend.portfolioId,
            assetId: asset.id,
            type: 'DIVIDEND',
            eventId,
            source: mode === 'reinvest' ? 'drip' : 'dividend_sync',
            subtype: mode === 'reinvest' ? 'REINVESTED_DIVIDEND' : null,
            isSystemGenerated: false,
            quantity: 1,
            price: amount,
            priceUSD,
            exchangeRate,
            fee: 0,
            currency: dividend.currency,
            date: dividend.payDate || dividend.exDate,
            notes: `${mode === 'reinvest' ? 'Reinvested dividend' : 'Dividend'}: ${dividend.sharesHeld} shares × ${dividend.dividendPerShare} per share`,
          },
        });

        let reinvestmentTransactionId: string | null = null;
        let reinvestmentQuantity: number | null = null;

        if (mode === 'reinvest' && normalizedReinvestPrice) {
          const quantity = amount / normalizedReinvestPrice;
          const reinvestCurrency = asset.currency || dividend.currency || 'USD';
          const {
            priceUSD: reinvestPriceUSD,
            exchangeRate: reinvestExchangeRate,
          } = await getPriceUSD(normalizedReinvestPrice, reinvestCurrency);

          const reinvestmentTransaction = await tx.transaction.create({
            data: {
              portfolioId: dividend.portfolioId,
              assetId: asset.id,
              type: 'BUY',
              eventId,
              source: 'drip',
              subtype: 'DRIP',
              isSystemGenerated: true,
              quantity,
              price: normalizedReinvestPrice,
              priceUSD: reinvestPriceUSD,
              exchangeRate: reinvestExchangeRate,
              fee: 0,
              currency: reinvestCurrency,
              date: normalizedReinvestDate || dividend.payDate || dividend.exDate,
              notes: `Dividend reinvestment from ${amount.toFixed(2)} ${dividend.currency}`,
            },
          });

          reinvestmentTransactionId = reinvestmentTransaction.id;
          reinvestmentQuantity = quantity;
        }

        confirmedResults.push({
          dividendId: dividend.id,
          transactionId: transaction.id,
          reinvestmentTransactionId,
          ticker: dividend.ticker,
          amount,
          mode,
          reinvestmentQuantity,
        });
      }

      return confirmedResults;
    });

    if (results.length !== ids.length) {
      return NextResponse.json(
        { error: 'Failed to confirm all pending dividends' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      confirmed: results,
    });

  } catch (error) {
    console.error('Failed to confirm dividend:', error);

    if (error instanceof Error) {
      if (error.message === 'Invalid dividend amount') {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      if (
        error.message.startsWith('Pending dividend not found for id:')
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to confirm dividend' },
      { status: 500 }
    );
  }
}
