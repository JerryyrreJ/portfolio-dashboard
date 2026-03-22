import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/transactions/dividends/pending/[id]
 * 删除单个待确认分红记录（用于清理测试数据）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleted = await prisma.pendingDividend.delete({
      where: { id },
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
    const { id } = await params;
    const body = await request.json();
    const { calculatedAmount } = body;

    if (calculatedAmount === undefined || calculatedAmount < 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const updated = await prisma.pendingDividend.update({
      where: { id },
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
