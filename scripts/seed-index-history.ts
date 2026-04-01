/**
 * One-time seed script: fetches full historical daily closes for SPY and QQQ
 * and upserts them into the IndexPriceHistory table.
 *
 * Run with:
 *   npx tsx --env-file=.env scripts/seed-index-history.ts
 *
 * (dotenv is available as a devDependency, but tsx's --env-file flag is simpler
 *  for scripts. If you prefer dotenv explicitly, add `import 'dotenv/config'` at
 *  the top and run without --env-file.)
 */

import prisma from '../src/lib/prisma';

const API_KEY = process.env.TWELVEDATA_API_KEY || '';
const BASE_URL = 'https://api.twelvedata.com';

interface TDValue {
  datetime: string;
  close: string;
}

async function fetchRange(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; price: number }[]> {
  const url = new URL(`${BASE_URL}/time_series`);
  url.searchParams.set('apikey', API_KEY);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', '1day');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('outputsize', '5000');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${symbol} ${startDate}–${endDate}`);
  }
  const data = await res.json();
  if (data.status === 'error' || !data.values || data.values.length === 0) {
    console.warn(`No data for ${symbol} ${startDate}–${endDate}:`, data.message ?? '(empty)');
    return [];
  }

  return ([...data.values] as TDValue[])
    .reverse()
    .map(v => ({
      date: v.datetime.split(' ')[0],
      price: parseFloat(v.close),
    }));
}

async function upsert(ticker: string, rows: { date: string; price: number }[]) {
  if (rows.length === 0) return;
  const values = rows.map(p => `('${ticker}', '${p.date}'::date, ${p.price})`).join(',');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "IndexPriceHistory" (ticker, date, close)
    VALUES ${values}
    ON CONFLICT (ticker, date) DO UPDATE SET close = EXCLUDED.close
  `);
}

// SPY inception: 1993-01-29  (~8300 trading days → two requests)
// QQQ inception: 1999-03-10  (~6500 trading days → one request)
const INDICES = [
  {
    ticker: 'SPY',
    batches: [
      { start: '1993-01-29', end: '2009-12-31' },
      { start: '2010-01-01', end: new Date().toISOString().split('T')[0] },
    ],
  },
  {
    ticker: 'QQQ',
    batches: [
      { start: '1999-03-10', end: new Date().toISOString().split('T')[0] },
    ],
  },
];

async function main() {
  if (!API_KEY) {
    console.error('TWELVEDATA_API_KEY is not set. Aborting.');
    process.exit(1);
  }

  for (const { ticker, batches } of INDICES) {
    let total = 0;
    for (const { start, end } of batches) {
      console.log(`Fetching ${ticker} ${start} → ${end} …`);
      const rows = await fetchRange(ticker, start, end);
      console.log(`  Got ${rows.length} rows, upserting…`);
      await upsert(ticker, rows);
      total += rows.length;
      // Brief pause between requests to be polite to the API
      if (batches.indexOf({ start, end }) < batches.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    console.log(`${ticker}: ${total} rows seeded.`);
  }

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
