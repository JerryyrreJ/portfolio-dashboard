import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/transactions/dividends/confirm
 * 确认分红并创建 DIVIDEND 类型的 Transaction
 *
 * Body: { id: string, finalAmount?: number } 或 { ids: string[], adjustments?: { [id: string]: number } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 支持单个确认或批量确认
    const ids = body.ids || (body.id ? [body.id] : []);
    const adjustments = body.adjustments || {};
    const finalAmount = body.finalAmount; // 单个确认时的金额调整

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing id or ids parameter' },
        { status: 400 }
      );
    }

    // 获取待确认的分红记录
    const pendingDividends = await prisma.pendingDividend.findMany({
      where: {
        id: { in: ids },
        status: 'pending',
      },
    });

    if (pendingDividends.length === 0) {
      return NextResponse.json(
        { error: 'No pending dividends found' },
        { status: 404 }
      );
    }

    const results = [];

    for (const dividend of pendingDividends) {
      // 确定最终金额：优先使用用户调整的金额，否则使用计算金额
      let amount = dividend.calculatedAmount;
      if (ids.length === 1 && finalAmount !== undefined) {
        amount = finalAmount;
      } else if (adjustments[dividend.id] !== undefined) {
        amount = adjustments[dividend.id];
      }

      // 获取 Asset ID
      const asset = await prisma.asset.findUnique({
        where: { ticker: dividend.ticker },
      });

      if (!asset) {
        console.warn(`Asset not found for ticker: ${dividend.ticker}`);
        continue;
      }

      // 创建 DIVIDEND 类型的 Transaction
      const transaction = await prisma.transaction.create({
        data: {
          portfolioId: dividend.portfolioId,
          assetId: asset.id,
          type: 'DIVIDEND',
          quantity: 1, // 分红记录 quantity 为 1
          price: amount, // price 字段存储分红金额
          priceUSD: amount, // 简化处理，假设已经是 USD 或后续转换
          exchangeRate: 1,
          fee: 0,
          currency: dividend.currency,
          date: dividend.payDate || dividend.exDate, // 优先使用支付日期
          notes: `Dividend: ${dividend.sharesHeld} shares × ${dividend.dividendPerShare} per share`,
        },
      });

      // 标记为已确认
      await prisma.pendingDividend.update({
        where: { id: dividend.id },
        data: { status: 'confirmed' },
      });

      results.push({
        dividendId: dividend.id,
        transactionId: transaction.id,
        ticker: dividend.ticker,
        amount,
      });
    }

    return NextResponse.json({
      success: true,
      confirmed: results,
    });

  } catch (error) {
    console.error('Failed to confirm dividend:', error);
    return NextResponse.json(
      { error: 'Failed to confirm dividend' },
      { status: 500 }
    );
  }
}
