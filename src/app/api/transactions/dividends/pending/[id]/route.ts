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
