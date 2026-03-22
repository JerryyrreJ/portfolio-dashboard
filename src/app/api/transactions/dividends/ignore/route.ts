import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/transactions/dividends/ignore
 * 忽略待确认的分红
 *
 * Body: { id: string } 或 { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 支持单个忽略或批量忽略
    const ids = body.ids || (body.id ? [body.id] : []);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing id or ids parameter' },
        { status: 400 }
      );
    }

    // 标记为已忽略
    const result = await prisma.pendingDividend.updateMany({
      where: {
        id: { in: ids },
        status: 'pending',
      },
      data: {
        status: 'ignored',
      },
    });

    return NextResponse.json({
      success: true,
      ignored: result.count,
    });

  } catch (error) {
    console.error('Failed to ignore dividend:', error);
    return NextResponse.json(
      { error: 'Failed to ignore dividend' },
      { status: 500 }
    );
  }
}
