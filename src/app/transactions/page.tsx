import type { Prisma } from '@prisma/client';
import { getCompanyProfile } from '@/lib/finnhub';
import { getLogo as getTwelveDataLogo } from '@/lib/twelvedata';
import { createServerProfiler } from '@/lib/perf';
import { getUser } from '@/lib/supabase-server';
import prisma, { withRetry } from '@/lib/prisma';
import TransactionsClient from './TransactionsClient';

interface TransactionWithAsset {
  id: string;
  type: string;
  eventId?: string | null;
  source?: string | null;
  subtype?: string | null;
  isSystemGenerated?: boolean;
  quantity: number;
  price: number;
  priceUSD: number;
  fee: number;
  currency: string;
  date: Date;
  notes?: string | null;
  asset: {
    id: string;
    ticker: string;
    name: string;
    market: string;
    logo?: string | null;
  };
}


async function getPortfolioWithTransactions(
  userId: string,
  searchParams: { [key: string]: string | undefined }
): Promise<{ portfolioId: string; portfolioName: string; transactions: TransactionWithAsset[]; total: number }> {
  const perf = createServerProfiler('transactions/data', searchParams.pid ? `pid=${searchParams.pid}` : undefined);
  const page = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const ticker = searchParams.ticker;
  const type = searchParams.type;
  const pid = searchParams.pid;

  // 按 pid 查找，找不到则 fallback 到第一个
  const portfolio = pid
    ? await perf.time('portfolio.findFirstByPid', () => withRetry(() => prisma.portfolio.findFirst({
        where: { id: pid, userId },
        select: { id: true, name: true },
      })))
    : null;

  const resolvedPortfolio = portfolio ?? await perf.time('portfolio.findFirstFallback', () => withRetry(() => prisma.portfolio.findFirst({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })));

  if (!resolvedPortfolio) {
    perf.flush('no-portfolio');
    return { portfolioId: '', portfolioName: 'Portfolio', transactions: [], total: 0 };
  }

  const where: Prisma.TransactionWhereInput = { portfolioId: resolvedPortfolio.id };
  if (ticker) where.asset = { ticker: { contains: ticker, mode: 'insensitive' } };
  if (type && ['BUY', 'SELL'].includes(type)) where.type = type;

  const [transactions, total] = await perf.time('transactions.findMany+count', () => Promise.all([
    prisma.transaction.findMany({
      where,
      include: { asset: true },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]));

  perf.flush(`portfolio=${resolvedPortfolio.id} rows=${transactions.length} total=${total}`);
  return {
    portfolioId: resolvedPortfolio.id,
    portfolioName: resolvedPortfolio.name,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      eventId: transaction.eventId,
      source: transaction.source,
      subtype: transaction.subtype,
      isSystemGenerated: transaction.isSystemGenerated,
      quantity: transaction.quantity,
      price: transaction.price,
      priceUSD: transaction.priceUSD,
      fee: transaction.fee,
      currency: transaction.currency,
      date: transaction.date,
      notes: transaction.notes,
      asset: {
        id: transaction.asset.id,
        ticker: transaction.asset.ticker,
        name: transaction.asset.name,
        market: transaction.asset.market,
        logo: transaction.asset.logo,
      },
    })),
    total,
  };
}

export default async function TransactionsPage(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const perf = createServerProfiler('transactions/page');
  // Parallelize user auth and searchParams resolution
  const [user, searchParams] = await Promise.all([
    getUser(),
    props.searchParams,
  ]);
  const isLoggedIn = !!user;

  let portfolioId = '';
  let portfolioName = 'Portfolio';
  let transactions: TransactionWithAsset[] = [];
  let total = 0;

  if (isLoggedIn) {
    try {
      const data = await perf.time('getPortfolioWithTransactions', () => getPortfolioWithTransactions(user!.id, searchParams));
      portfolioId = data.portfolioId;
      portfolioName = data.portfolioName;
      transactions = data.transactions;
      total = data.total;
    } catch {
      // DB unreachable — leave transactions empty
    }
  }

  const uniqueAssets = Array.from(new Map(transactions.map(t => [t.asset.ticker, t.asset])).values());
  const logoMap: Record<string, string | null> = {};

  const missingLogos = uniqueAssets.filter(a => !a.logo);
  if (missingLogos.length > 0) {
    (async () => {
      const CONCURRENCY = 5;
      for (let i = 0; i < missingLogos.length; i += CONCURRENCY) {
        const batch = missingLogos.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(async (asset) => {
          try {
            // Finnhub first
            const profile = await getCompanyProfile(asset.ticker);
            let logoUrl = profile?.logo || null;
            // Twelve Data fallback
            if (!logoUrl) {
              logoUrl = await getTwelveDataLogo(asset.ticker);
            }
            if (logoUrl) {
              await prisma.asset.update({ where: { id: asset.id }, data: { logo: logoUrl } });
            }
          } catch (err) {
            console.warn(`Failed to cache logo for ${asset.ticker}:`, err);
          }
        }));
      }
    })();
  }

  for (const asset of uniqueAssets) {
    logoMap[asset.ticker] = asset.logo || null;
  }

  const currentPage = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const totalPages = Math.ceil(total / limit);
  const buyCount = transactions.filter(t => t.type === 'BUY').length;
  const sellCount = transactions.filter(t => t.type === 'SELL').length;
  const totalVolume = transactions.reduce((sum, t) => sum + (t.price * t.quantity), 0);

  const userDisplayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
    : ''

  perf.flush(`loggedIn=${isLoggedIn} rows=${transactions.length} page=${currentPage}`);
  return (
    <TransactionsClient
      transactions={transactions}
      total={total}
      totalPages={totalPages}
      currentPage={currentPage}
      limit={limit}
      portfolioId={portfolioId}
      portfolioName={portfolioName}
      logoMap={logoMap}
      searchTicker={searchParams.ticker}
      searchType={searchParams.type}
      buyCount={buyCount}
      sellCount={sellCount}
      totalVolume={totalVolume}
      userDisplayName={userDisplayName}
    />
  );
}
