import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 获取所有资产列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const market = searchParams.get('market');
    const search = searchParams.get('search');

    const where: any = {};

    if (market) {
      where.market = market;
    }

    if (search) {
      where.OR = [
        { ticker: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: {
        ticker: 'asc',
      },
    });

    return NextResponse.json({
      assets: assets.map(asset => ({
        id: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        market: asset.market,
      })),
    });

  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

// 创建新资产
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证必填字段
    if (!body.ticker || !body.name) {
      return NextResponse.json(
        { error: 'Ticker and name are required' },
        { status: 400 }
      );
    }

    // 检查是否已存在相同 ticker 的资产
    const existingAsset = await prisma.asset.findFirst({
      where: {
        ticker: {
          equals: body.ticker,
          mode: 'insensitive',
        },
      },
    });

    if (existingAsset) {
      return NextResponse.json(
        {
          error: 'Asset with this ticker already exists',
          existingAsset: {
            id: existingAsset.id,
            ticker: existingAsset.ticker,
            name: existingAsset.name,
          }
        },
        { status: 409 }
      );
    }

    // 创建新资产
    const asset = await prisma.asset.create({
      data: {
        ticker: body.ticker.toUpperCase(),
        name: body.name,
        market: body.market || 'US', // 默认美股
      },
    });

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        market: asset.market,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to create asset:', error);
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    );
  }
}
