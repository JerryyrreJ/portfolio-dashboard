import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  findOwnedPendingDividends,
  requireAuthenticatedUser,
} from '@/lib/ownership';

/**
 * POST /api/transactions/dividends/ignore
 * 忽略待确认的分红
 *
 * Body: { id: string } 或 { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // 支持单个忽略或批量忽略
    const requestedIds: string[] = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string')
      : typeof body.id === 'string'
        ? [body.id]
        : [];
    const ids = Array.from(new Set<string>(requestedIds));

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing id or ids parameter' },
        { status: 400 }
      );
    }

    const ownedPendingDividends = await findOwnedPendingDividends(user.id, ids);
    const pendingIds = ownedPendingDividends
      .filter((dividend) => dividend.status === 'pending')
      .map((dividend) => dividend.id);

    if (pendingIds.length !== ids.length) {
      return NextResponse.json(
        { error: 'Pending dividends not found' },
        { status: 404 }
      );
    }

    // 标记为已忽略
    const result = await prisma.pendingDividend.updateMany({
      where: {
        id: { in: pendingIds },
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
