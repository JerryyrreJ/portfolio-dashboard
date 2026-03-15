import { getCompanyProfile } from '@/lib/finnhub';
import { getUser } from '@/lib/supabase-server';
import prisma, { withRetry } from '@/lib/prisma';
import TransactionsClient from './TransactionsClient';

interface TransactionWithAsset {
  id: string;
  type: string;
  quantity: number;
  price: number;
  priceUSD: number;
  fee: number;
  currency: string;
  date: Date;
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
  const page = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const ticker = searchParams.ticker;
  const type = searchParams.type;

  const portfolio = await withRetry(() => prisma.portfolio.findFirst({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  }));

  if (!portfolio) return { portfolioId: '', portfolioName: 'Portfolio', transactions: [], total: 0 };

  const where: any = { portfolioId: portfolio.id };
  if (ticker) where.asset = { ticker: { contains: ticker, mode: 'insensitive' } };
  if (type && ['BUY', 'SELL'].includes(type)) where.type = type;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { asset: true },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    transactions: transactions as TransactionWithAsset[],
    total,
  };
}

export default async function TransactionsPage(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
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
      const data = await getPortfolioWithTransactions(user!.id, searchParams);
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
      for (const asset of missingLogos) {
        try {
          const profile = await getCompanyProfile(asset.ticker);
          if (profile?.logo) {
            await prisma.asset.update({ where: { id: asset.id }, data: { logo: profile.logo } });
          }
        } catch (err) {
          console.warn(`Failed to cache logo for ${asset.ticker}:`, err);
        }
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

  return (
    <TransactionsClient
      transactions={transactions}
      total={total}
      totalPages={totalPages}
      currentPage={currentPage}
      limit={limit}
      portfolioName={portfolioName}
      logoMap={logoMap}
      searchTicker={searchParams.ticker}
      searchType={searchParams.type}
      buyCount={buyCount}
      sellCount={sellCount}
      totalVolume={totalVolume}
    />
  );
}
