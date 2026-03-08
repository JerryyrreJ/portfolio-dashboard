import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

// 根据 ticker 查找资产
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ticker = searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker parameter is required' },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.findFirst({
      where: {
        ticker: ticker.toUpperCase(),
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: asset.id,
      ticker: asset.ticker,
      name: asset.name,
      market: asset.market,
    });

  } catch (error) {
    console.error('Failed to lookup asset:', error);
    return NextResponse.json(
      { error: 'Failed to lookup asset' },
      { status: 500 }
    );
  }
}
