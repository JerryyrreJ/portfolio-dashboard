import { NextRequest, NextResponse } from 'next/server';
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

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing id or ids parameter' },
        { status: 400 }
      );
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
          ...fx,
        };
      })
    );

    const results = await prisma.$transaction(async (tx) => {
      const confirmedResults = [];

      for (const { dividend, amount, priceUSD, exchangeRate } of normalizedDividends) {
        const asset = await tx.asset.findUnique({
          where: { ticker: dividend.ticker },
        });

        if (!asset) {
          throw new Error(`Asset not found for ticker: ${dividend.ticker}`);
        }

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
            quantity: 1,
            price: amount,
            priceUSD,
            exchangeRate,
            fee: 0,
            currency: dividend.currency,
            date: dividend.payDate || dividend.exDate,
            notes: `Dividend: ${dividend.sharesHeld} shares × ${dividend.dividendPerShare} per share`,
          },
        });

        confirmedResults.push({
          dividendId: dividend.id,
          transactionId: transaction.id,
          ticker: dividend.ticker,
          amount,
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
        error.message.startsWith('Asset not found for ticker:') ||
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
