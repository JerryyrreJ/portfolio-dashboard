import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const formatType = searchParams.get('format') || 'csv';
    const range = searchParams.get('range') || 'all';

    // Build the date filter based on range
    let dateFilter = {};
    const now = new Date();
    if (range === 'ytd') {
      dateFilter = {
        gte: new Date(now.getFullYear(), 0, 1),
      };
    } else if (range === '12m') {
      const lastYear = new Date();
      lastYear.setFullYear(now.getFullYear() - 1);
      dateFilter = {
        gte: lastYear,
      };
    }

    // Fetch the transactions
    const portfolio = await prisma.portfolio.findFirst({
      where: { userId: user.id },
      include: {
        transactions: {
          where: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : undefined,
          orderBy: { date: 'desc' },
          include: {
            asset: true,
          },
        },
      },
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const transactions = portfolio.transactions;

    if (formatType === 'json') {
      const cleanData = {
        portfolio: {
          name: portfolio.name,
          currency: portfolio.currency,
        },
        exportDate: new Date().toISOString(),
        range,
        transactions: transactions.map(t => ({
          date: format(new Date(t.date), 'yyyy-MM-dd'),
          ticker: t.asset.ticker,
          name: t.asset.name,
          market: t.asset.market,
          type: t.type,
          quantity: Math.abs(t.quantity),
          price: t.price,
          currency: t.currency || 'USD',
          fee: t.fee ?? 0,
          totalValue: (Math.abs(t.quantity) * t.price).toFixed(2),
          notes: t.notes ?? '',
        })),
      };

      return new NextResponse(JSON.stringify(cleanData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="portfolio_transactions_${range}.json"`,
        },
      });
    }

    // Default to CSV
    const escape = (val: string | number) => {
      const s = String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csvHeader = 'Date,Ticker,Name,Market,Type,Quantity,Price,Currency,Fee,Total Value,Notes\n';
    const csvRows = transactions.map((t) => {
      const date = format(new Date(t.date), 'yyyy-MM-dd');
      const total = (Math.abs(t.quantity) * t.price).toFixed(2);
      return [
        date,
        escape(t.asset.ticker),
        escape(t.asset.name),
        escape(t.asset.market),
        t.type,
        Math.abs(t.quantity),
        t.price,
        t.currency || 'USD',
        t.fee ?? 0,
        total,
        escape(t.notes ?? ''),
      ].join(',');
    }).join('\n');

    return new NextResponse(csvHeader + csvRows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="portfolio_transactions.csv"',
      },
    });

  } catch (error) {
    console.error('Error exporting transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
