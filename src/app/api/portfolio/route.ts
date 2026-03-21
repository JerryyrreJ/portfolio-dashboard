import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import prisma from '@/lib/prisma';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/portfolio — 返回用户所有 portfolios
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const portfolios = await prisma.portfolio.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ portfolios });
  } catch (error) {
    console.error('Failed to fetch portfolios:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/portfolio — 创建新 portfolio
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, currency } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const portfolio = await prisma.portfolio.create({
      data: { userId: user.id, name: name.trim(), currency: currency ?? 'USD' },
    });

    return NextResponse.json({ portfolio }, { status: 201 });
  } catch (error) {
    console.error('Failed to create portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/portfolio?id=xxx — 更新指定 portfolio
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    const body = await request.json();
    const { name, currency, preferences } = body;

    // 如果没有传 id，fallback 到旧行为（取第一个）
    const existing = id
      ? await prisma.portfolio.findUnique({ where: { id } })
      : await prisma.portfolio.findFirst({ where: { userId: user.id } });

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const updatedPortfolio = await prisma.portfolio.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name }),
        ...(currency !== undefined && { currency }),
        ...(preferences !== undefined && { preferences: JSON.stringify(preferences) }),
        settingsUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ portfolio: updatedPortfolio });
  } catch (error) {
    console.error('Failed to update portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/portfolio?id=xxx — 删除指定 portfolio（至少保留一个）
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await prisma.portfolio.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const count = await prisma.portfolio.count({ where: { userId: user.id } });
    if (count <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last portfolio' }, { status: 400 });
    }

    await prisma.portfolio.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
