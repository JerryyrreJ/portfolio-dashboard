import { NextRequest, NextResponse } from 'next/server';
import { getPriceUSD } from '@/lib/exchange-rate';
import prisma from '@/lib/prisma';
import { findOwnedPortfolio, requireAuthenticatedUser } from '@/lib/ownership';

const MAX_LIMIT = 200;

function parsePositiveNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseNonNegativeNumber(value: unknown, fallback = 0): number | null {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parsePaginationValue(value: string | null, fallback: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

// 创建新交易记录
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // 验证必填字段（注意：数字 0 不算缺失，由下面的范围校验去处理）
    const requiredFields = ['portfolioId', 'assetId', 'type', 'quantity', 'price', 'date'];
    for (const field of requiredFields) {
      const value = body[field];
      if (value === undefined || value === null || value === '') {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // 验证交易类型
    if (!['BUY', 'SELL'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Invalid transaction type. Must be BUY or SELL' },
        { status: 400 }
      );
    }

    const quantity = parsePositiveNumber(body.quantity);
    const price = parsePositiveNumber(body.price);
    const fee = parseNonNegativeNumber(body.fee, 0);
    const date = parseIsoDate(body.date);

    // 验证数量和价格为正数
    if (quantity === null || price === null) {
      return NextResponse.json(
        { error: 'Quantity and price must be positive numbers' },
        { status: 400 }
      );
    }
    if (fee === null) {
      return NextResponse.json(
        { error: 'Fee must be a non-negative number' },
        { status: 400 }
      );
    }
    if (date === null) {
      return NextResponse.json(
        { error: 'Invalid date' },
        { status: 400 }
      );
    }

    // 服务端计算 priceUSD 和 exchangeRate
    const currency = body.currency || 'USD';
    const { priceUSD, exchangeRate } = await getPriceUSD(price, currency);

    const portfolio = await findOwnedPortfolio(user.id, body.portfolioId);
    if (!portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // 创建交易记录
    const transaction = await prisma.transaction.create({
      data: {
        portfolioId: body.portfolioId,
        assetId: body.assetId,
        type: body.type,
        quantity,
        price,
        fee,
        date,
        currency,
        exchangeRate,
        priceUSD,
        notes: body.notes || null,
      },
      include: {
        asset: true,
        portfolio: true,
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        eventId: transaction.eventId,
        source: transaction.source,
        subtype: transaction.subtype,
        isSystemGenerated: transaction.isSystemGenerated,
        quantity: transaction.quantity,
        price: transaction.price,
        fee: transaction.fee,
        date: transaction.date,
        asset: {
          ticker: transaction.asset.ticker,
          name: transaction.asset.name,
          market: transaction.asset.market,
        },
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to create transaction:', error);

    // 处理 Prisma 特有的错误
    if (error instanceof Error && error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        { error: 'Invalid portfolio or asset ID' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// 获取交易记录列表
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const portfolioId = searchParams.get('portfolioId');
    const rawLimit = parsePaginationValue(searchParams.get('limit'), 50);
    const rawOffset = parsePaginationValue(searchParams.get('offset'), 0);
    if (rawLimit === null || rawOffset === null) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    const limit = Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
    const offset = Math.max(rawOffset, 0);

    if (portfolioId) {
      const portfolio = await findOwnedPortfolio(user.id, portfolioId);
      if (!portfolio) {
        return NextResponse.json(
          { error: 'Portfolio not found' },
          { status: 404 }
        );
      }
    }

    const where = {
      portfolio: { userId: user.id },
      ...(portfolioId ? { portfolioId } : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          asset: true,
        },
        orderBy: {
          date: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        eventId: t.eventId,
        source: t.source,
        subtype: t.subtype,
        isSystemGenerated: t.isSystemGenerated,
        quantity: t.quantity,
        price: t.price,
        fee: t.fee,
        date: t.date,
        asset: {
          ticker: t.asset.ticker,
          name: t.asset.name,
          market: t.asset.market,
        },
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
