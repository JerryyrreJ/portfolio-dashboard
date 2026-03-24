import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  findOwnedPendingDividends,
  requireAuthenticatedUser,
} from '@/lib/ownership';

/**
 * DELETE /api/transactions/dividends/pending/[id]
 * 删除单个待确认分红记录（用于清理测试数据）
 */
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
    const [existing] = await findOwnedPendingDividends(user.id, [id]);

    if (!existing) {
      return NextResponse.json(
        { error: 'Pending dividend not found' },
        { status: 404 }
      );
    }

    const deleted = await prisma.pendingDividend.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({
      success: true,
      deleted: deleted.id,
    });

  } catch (error) {
    console.error('Failed to delete pending dividend:', error);
    return NextResponse.json(
      { error: 'Failed to delete pending dividend' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/transactions/dividends/pending/[id]
 * 更新待确认分红的金额（用于手动调整）
 */
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
    const { calculatedAmount } = body;

    if (calculatedAmount === undefined || calculatedAmount < 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const [existing] = await findOwnedPendingDividends(user.id, [id]);
    if (!existing) {
      return NextResponse.json(
        { error: 'Pending dividend not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.pendingDividend.update({
      where: { id: existing.id },
      data: { calculatedAmount: parseFloat(calculatedAmount) },
    });

    return NextResponse.json({
      success: true,
      updated: {
        id: updated.id,
        calculatedAmount: updated.calculatedAmount,
      },
    });

  } catch (error) {
    console.error('Failed to update pending dividend:', error);
    return NextResponse.json(
      { error: 'Failed to update pending dividend' },
      { status: 500 }
    );
  }
}
