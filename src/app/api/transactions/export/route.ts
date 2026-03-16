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
      return new NextResponse(JSON.stringify(transactions, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="portfolio_transactions.json"',
        },
      });
    }

    // Default to CSV
    const csvHeader = 'Date,Asset,Type,Quantity,Price,Currency,Total Value,Notes\n';
    const csvRows = transactions.map((t) => {
      const date = format(new Date(t.date), 'yyyy-MM-dd');
      const asset = t.asset.ticker;
      const type = t.type;
      const quantity = t.quantity.toString();
      const price = t.price.toString();
      const currency = t.currency || 'USD';
      const total = (t.quantity * t.price).toFixed(2);
      const notes = ''; // Transactions table doesn't have a notes field based on schema
      
      return `${date},${asset},${type},${quantity},${price},${currency},${total},${notes}`;
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
