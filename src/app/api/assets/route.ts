import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/ownership';

interface CreateAssetRequest {
  ticker?: string;
  name?: string;
  market?: string;
  currency?: string;
}

// 获取所有资产列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const market = searchParams.get('market');
    const search = searchParams.get('search');

    const where: Prisma.AssetWhereInput = {};

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
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateAssetRequest = await request.json();

    // 验证必填字段
    if (!body.ticker || !body.name) {
      return NextResponse.json(
        { error: 'Ticker and name are required' },
        { status: 400 }
      );
    }

    const ticker = body.ticker.toUpperCase();

    // 检查是否已存在相同 ticker 的资产
    const existingAsset = await prisma.asset.findUnique({
      where: { ticker },
      select: { id: true, ticker: true, name: true },
    });

    if (existingAsset) {
      return NextResponse.json(
        {
          error: 'Asset with this ticker already exists',
          existingAsset,
        },
        { status: 409 }
      );
    }

    // 创建新资产
    const asset = await prisma.asset.create({
      data: {
        ticker,
        name: body.name,
        market: body.market || 'US',
        currency: body.currency || 'USD',
      },
    });

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        market: asset.market,
        currency: asset.currency,
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
