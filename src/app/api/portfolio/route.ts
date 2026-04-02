import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { createServerProfiler } from '@/lib/perf';
import prisma from '@/lib/prisma';

async function getUser() {
  const perf = createServerProfiler('api/portfolio.auth');
  const cookieStore = await perf.time('cookies', () => cookies());
  const supabase = await perf.time('createServerClient', async () => createServerClient(
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
  ));
  const { data: { user } } = await perf.time('auth.getUser', () => supabase.auth.getUser());
  perf.flush(`result=${user ? 'user' : 'null'}`);
  return user;
}

// GET /api/portfolio — 返回用户所有 portfolios
export async function GET() {
  const perf = createServerProfiler('api/portfolio.GET');
  try {
    const user = await perf.time('getUser', () => getUser());
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const portfolios = await perf.time('portfolio.findMany', () => prisma.portfolio.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }));

    perf.flush(`user=${user.id} rows=${portfolios.length}`);
    return NextResponse.json({ portfolios });
  } catch (error) {
    console.error('Failed to fetch portfolios:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/portfolio — 创建新 portfolio
export async function POST(request: NextRequest) {
  const perf = createServerProfiler('api/portfolio.POST');
  try {
    const user = await perf.time('getUser', () => getUser());
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, currency } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const portfolio = await perf.time('portfolio.create', () => prisma.portfolio.create({
      data: { userId: user.id, name: name.trim(), currency: currency ?? 'USD' },
    }));

    perf.flush(`user=${user.id} portfolio=${portfolio.id}`);
    return NextResponse.json({ portfolio }, { status: 201 });
  } catch (error) {
    console.error('Failed to create portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/portfolio?id=xxx — 更新指定 portfolio
export async function PATCH(request: NextRequest) {
  const perf = createServerProfiler('api/portfolio.PATCH');
  try {
    const user = await perf.time('getUser', () => getUser());
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    const body = await request.json();
    const { name, currency, preferences } = body;

    // 如果没有传 id，fallback 到旧行为（取第一个）
    const existing = id
      ? await perf.time('portfolio.findUnique', () => prisma.portfolio.findUnique({ where: { id } }))
      : await perf.time('portfolio.findFirst', () => prisma.portfolio.findFirst({ where: { userId: user.id } }));

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const updatedPortfolio = await perf.time('portfolio.update', () => prisma.portfolio.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name }),
        ...(currency !== undefined && { currency }),
        ...(preferences !== undefined && { preferences: JSON.stringify(preferences) }),
        settingsUpdatedAt: new Date(),
      },
    }));

    perf.flush(`user=${user.id} portfolio=${updatedPortfolio.id}`);
    return NextResponse.json({ portfolio: updatedPortfolio });
  } catch (error) {
    console.error('Failed to update portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/portfolio?id=xxx — 删除指定 portfolio（至少保留一个）
export async function DELETE(request: NextRequest) {
  const perf = createServerProfiler('api/portfolio.DELETE');
  try {
    const user = await perf.time('getUser', () => getUser());
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await perf.time('portfolio.findUnique', () => prisma.portfolio.findUnique({ where: { id } }));
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const count = await perf.time('portfolio.count', () => prisma.portfolio.count({ where: { userId: user.id } }));
    if (count <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last portfolio' }, { status: 400 });
    }

    await perf.time('portfolio.delete', () => prisma.portfolio.delete({ where: { id } }));
    perf.flush(`user=${user.id} portfolio=${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete portfolio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
