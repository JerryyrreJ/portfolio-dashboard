import { NextRequest, NextResponse } from 'next/server';

import { getPriceUSD } from '@/lib/exchange-rate';
import prisma from '@/lib/prisma';
import {
  findOwnedTransaction,
  requireAuthenticatedUser,
} from '@/lib/ownership';

function isManagedDripTransaction(transaction: {
  source?: string | null;
  subtype?: string | null;
}) {
  return (
    transaction.source === 'drip' ||
    transaction.subtype === 'DRIP' ||
    transaction.subtype === 'REINVESTED_DIVIDEND'
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSameNumber(a: number, b: number, epsilon: number = 1e-9) {
  return Math.abs(a - b) <= epsilon;
}

// PATCH /api/transactions/[id] - 编辑交易
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsedQuantity = parseOptionalNumber(body.quantity);
    const parsedPrice = parseOptionalNumber(body.price);
    const parsedFee = parseOptionalNumber(body.fee);

    if (parsedQuantity === null || parsedPrice === null || parsedFee === null) {
      return NextResponse.json(
        { error: 'Invalid numeric fields' },
        { status: 400 }
      );
    }

    const existingTransaction = await findOwnedTransaction(user.id, id);
    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (isManagedDripTransaction(existingTransaction)) {
      if (!existingTransaction.eventId) {
        return NextResponse.json(
          { error: 'Managed DRIP transaction is missing an eventId' },
          { status: 409 }
        );
      }

      const relatedTransactions = await prisma.transaction.findMany({
        where: {
          portfolioId: existingTransaction.portfolioId,
          eventId: existingTransaction.eventId,
        },
      });

      const dividendTransaction = relatedTransactions.find(
        (transaction) =>
          transaction.subtype === 'REINVESTED_DIVIDEND' ||
          (transaction.type === 'DIVIDEND' && transaction.source === 'drip')
      );
      const buyTransaction = relatedTransactions.find(
        (transaction) =>
          transaction.subtype === 'DRIP' ||
          (transaction.type === 'BUY' && transaction.source === 'drip')
      );

      if (!dividendTransaction || !buyTransaction) {
        return NextResponse.json(
          { error: 'Managed DRIP event is incomplete' },
          { status: 409 }
        );
      }

      let nextDividendAmount = dividendTransaction.price;
      let nextDividendDate = dividendTransaction.date;
      let nextDividendFee = dividendTransaction.fee;
      let nextBuyPrice = buyTransaction.price;
      let nextBuyQuantity = buyTransaction.quantity;
      let nextBuyDate = buyTransaction.date;
      let nextBuyFee = buyTransaction.fee;

      const requestedDate = body.date ? new Date(body.date) : undefined;
      if (body.date && Number.isNaN(requestedDate?.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date' },
          { status: 400 }
        );
      }

      if (existingTransaction.id === dividendTransaction.id) {
        if (isFiniteNumber(parsedPrice)) {
          nextDividendAmount = parsedPrice;
        }
        if (requestedDate) {
          nextDividendDate = requestedDate;
        }
        if (isFiniteNumber(parsedFee)) {
          nextDividendFee = parsedFee;
        }
        if (nextDividendAmount <= 0) {
          return NextResponse.json(
            { error: 'Dividend amount must be greater than 0' },
            { status: 400 }
          );
        }
        nextBuyQuantity = nextDividendAmount / nextBuyPrice;
      } else if (existingTransaction.id === buyTransaction.id) {
        const quantityChanged =
          isFiniteNumber(parsedQuantity) && !isSameNumber(parsedQuantity, buyTransaction.quantity);
        const priceChanged =
          isFiniteNumber(parsedPrice) && !isSameNumber(parsedPrice, buyTransaction.price);

        if (priceChanged || !quantityChanged) {
          if (isFiniteNumber(parsedPrice)) {
            nextBuyPrice = parsedPrice;
          }
          if (nextBuyPrice <= 0) {
            return NextResponse.json(
              { error: 'Reinvestment price must be greater than 0' },
              { status: 400 }
            );
          }
          nextBuyQuantity = nextDividendAmount / nextBuyPrice;
        } else if (isFiniteNumber(parsedQuantity)) {
          if (parsedQuantity <= 0) {
            return NextResponse.json(
              { error: 'Reinvestment quantity must be greater than 0' },
              { status: 400 }
            );
          }
          nextBuyQuantity = parsedQuantity;
          nextBuyPrice = nextDividendAmount / parsedQuantity;
        }

        if (requestedDate) {
          nextBuyDate = requestedDate;
        }
        if (isFiniteNumber(parsedFee)) {
          nextBuyFee = parsedFee;
        }
      }

      if (nextBuyQuantity <= 0 || !Number.isFinite(nextBuyQuantity)) {
        return NextResponse.json(
          { error: 'Reinvestment quantity must be greater than 0' },
          { status: 400 }
        );
      }

      const [dividendFx, buyFx] = await Promise.all([
        getPriceUSD(nextDividendAmount, dividendTransaction.currency),
        getPriceUSD(nextBuyPrice, buyTransaction.currency),
      ]);

      const [updatedDividend, updatedBuy] = await prisma.$transaction(async (tx) => Promise.all([
        tx.transaction.update({
          where: { id: dividendTransaction.id },
          data: {
            date: nextDividendDate,
            price: nextDividendAmount,
            priceUSD: dividendFx.priceUSD,
            exchangeRate: dividendFx.exchangeRate,
            fee: nextDividendFee,
          },
        }),
        tx.transaction.update({
          where: { id: buyTransaction.id },
          data: {
            date: nextBuyDate,
            quantity: nextBuyQuantity,
            price: nextBuyPrice,
            priceUSD: buyFx.priceUSD,
            exchangeRate: buyFx.exchangeRate,
            fee: nextBuyFee,
          },
        }),
      ]));

      return NextResponse.json({
        success: true,
        linked: true,
        eventId: existingTransaction.eventId,
        transactions: [updatedDividend, updatedBuy],
      });
    }

    const nextPrice = isFiniteNumber(parsedPrice) ? parsedPrice : existingTransaction.price;
    const nextFee = isFiniteNumber(parsedFee) ? parsedFee : existingTransaction.fee;

    if (
      (isFiniteNumber(parsedQuantity) && parsedQuantity <= 0) ||
      (isFiniteNumber(parsedPrice) && parsedPrice <= 0) ||
      (isFiniteNumber(parsedFee) && parsedFee < 0)
    ) {
      return NextResponse.json(
        { error: 'Invalid transaction values' },
        { status: 400 }
      );
    }

    const requestedDate = body.date ? new Date(body.date) : undefined;
    if (body.date && Number.isNaN(requestedDate?.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date' },
        { status: 400 }
      );
    }

    const fx = isFiniteNumber(parsedPrice)
      ? await getPriceUSD(nextPrice, existingTransaction.currency)
      : {
          priceUSD: existingTransaction.priceUSD,
          exchangeRate: existingTransaction.exchangeRate,
        };

    const updated = await prisma.transaction.update({
      where: { id: existingTransaction.id },
      data: {
        date: requestedDate,
        quantity: isFiniteNumber(parsedQuantity) ? parsedQuantity : undefined,
        price: isFiniteNumber(parsedPrice) ? parsedPrice : undefined,
        priceUSD: fx.priceUSD,
        exchangeRate: fx.exchangeRate,
        fee: isFiniteNumber(parsedFee) ? nextFee : undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
      },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE /api/transactions/[id] - 删除交易
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // 检查交易是否存在
    const existingTransaction = await findOwnedTransaction(user.id, id);

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (isManagedDripTransaction(existingTransaction)) {
      if (!existingTransaction.eventId) {
        return NextResponse.json(
          { error: 'Managed DRIP transaction is missing an eventId' },
          { status: 409 }
        );
      }

      await prisma.transaction.deleteMany({
        where: {
          portfolioId: existingTransaction.portfolioId,
          eventId: existingTransaction.eventId,
        },
      });

      return NextResponse.json({
        success: true,
        linked: true,
        eventId: existingTransaction.eventId,
        message: 'DRIP event deleted successfully',
      });
    }

    // 删除交易
    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully',
    });

  } catch (error) {
    console.error('Failed to delete transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
