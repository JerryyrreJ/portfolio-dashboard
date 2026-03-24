import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import {
  findOwnedTransaction,
  requireAuthenticatedUser,
} from '@/lib/ownership';

// PATCH /api/transactions/[id] - 编辑交易
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

    const existingTransaction = await findOwnedTransaction(user.id, id);
    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.transaction.update({
      where: { id: existingTransaction.id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        quantity: body.quantity !== undefined ? parseFloat(body.quantity) : undefined,
        price: body.price !== undefined ? parseFloat(body.price) : undefined,
        fee: body.fee !== undefined ? parseFloat(body.fee) : undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
      },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE /api/transactions/[id] - 删除交易
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

    if (!id) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // 检查交易是否存在
    const existingTransaction = await findOwnedTransaction(user.id, id);

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // 删除交易
    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully',
    });

  } catch (error) {
    console.error('Failed to delete transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
