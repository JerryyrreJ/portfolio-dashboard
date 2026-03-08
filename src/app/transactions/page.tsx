import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  ArrowLeft, Filter, Download, TrendingUp, TrendingDown,
  Search, ChevronRight, Home, MoreHorizontal, Trash2, Edit2
} from 'lucide-react';
import { getCompanyProfile } from '@/lib/finnhub';
import { getUser } from '@/lib/supabase-server';

const prisma = new PrismaClient();

interface TransactionWithAsset {
  id: string;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  date: Date;
  asset: {
    id: string;
    ticker: string;
    name: string;
    market: string;
    logo?: string | null;
  };
}

async function getTransactions(
  portfolioId: string,
  searchParams: { [key: string]: string | undefined }
): Promise<{ transactions: TransactionWithAsset[]; total: number }> {
  const page = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const ticker = searchParams.ticker;
  const type = searchParams.type;

  const where: any = {
    portfolioId,
  };

  if (ticker) {
    where.asset = {
      ticker: {
        contains: ticker,
        mode: 'insensitive',
      },
    };
  }

  if (type && ['BUY', 'SELL'].includes(type)) {
    where.type = type;
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        asset: true,
      },
      orderBy: {
        date: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions: transactions as TransactionWithAsset[], total };
}

async function getPortfolios(userId: string) {
  try {
    return await prisma.portfolio.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
  } catch {
    return [];
  }
}

// 格式化金额
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

// 格式化数字
function formatNumber(num: number, decimals: number = 4): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export default async function TransactionsPage(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = await getUser();
  const isLoggedIn = !!user;

  const searchParams = await props.searchParams;
  const portfolios = isLoggedIn ? await getPortfolios(user!.id) : [];
  const defaultPortfolioId = portfolios[0]?.id || '';
  const portfolioName = portfolios[0]?.name || 'Portfolio';

  // 如果未登录，直接返回空数据，不查 DB
  let transactions: TransactionWithAsset[] = [];
  let total = 0;

  if (isLoggedIn) {
    try {
      const data = await getTransactions(defaultPortfolioId, searchParams);
      transactions = data.transactions;
      total = data.total;
    } catch {
      // DB unreachable — leave transactions empty
    }
  }

  // 4. 智能 Logo 缓存逻辑 (交易页面)
  const uniqueAssets = Array.from(new Map(transactions.map(t => [t.asset.ticker, t.asset])).values());
  
  for (const asset of uniqueAssets) {
    if (!asset.logo) {
      console.log(`Fetching and caching logo for ${asset.ticker} (Transactions Page)`);
      try {
        const profile = await getCompanyProfile(asset.ticker);
        if (profile?.logo) {
          await prisma.asset.update({
            where: { id: asset.id },
            data: { logo: profile.logo }
          });
          asset.logo = profile.logo;
        }
      } catch (err) {
        console.error(`Failed to cache logo for ${asset.ticker}:`, err);
      }
    }
  }

  const currentPage = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const totalPages = Math.ceil(total / limit);

  const buyCount = transactions.filter(t => t.type === 'BUY').length;
  const sellCount = transactions.filter(t => t.type === 'SELL').length;
  const totalVolume = transactions.reduce((sum, t) => sum + (t.price * t.quantity), 0);

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">
      
      {/* 顶部导航栏 - 与首页一致 */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight cursor-pointer">
            <Link href="/" className="flex items-center space-x-2">
              <div className="bg-black text-white p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>PortfolioUI</span>
            </Link>
          </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-400">
            <Link href="/" className="hover:text-black transition-colors py-[16px]">Investments</Link>
            <Link href="/transactions" className="text-black border-b-2 border-black py-[16px]">Transactions</Link>
            <a href="#" className="hover:text-black transition-colors py-[16px]">History</a>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-gray-400" />
            <input 
              type="text" 
              placeholder="Search transactions" 
              className="bg-gray-100 border-none rounded-lg py-1.5 pl-9 pr-4 text-[13px] w-44 focus:w-60 focus:ring-1 focus:ring-black/5 focus:bg-white transition-all duration-300"
            />
          </div>
          <div className="flex items-center space-x-2 text-[14px] font-semibold cursor-pointer text-gray-500 hover:text-black transition-colors">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[11px] text-gray-500">JD</div>
            <span>Account</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-6 py-8">
        
        {/* Breadcrumbs & Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-gray-400 mb-2">
              <Link href="/" className="hover:text-black transition-colors">Dashboard</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-900">Transactions</span>
            </div>
            <h1 className="text-[32px] font-bold text-black tracking-tight leading-tight">Transaction History</h1>
            <p className="text-gray-500 font-medium mt-1">{total} recorded activities in {portfolioName}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* 顶部统计卡片 - 高密度设计 */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Total Volume</p>
            <p className="text-[20px] font-bold text-black text-center tabular-nums">{formatCurrency(totalVolume)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Buy Activity</p>
            <p className="text-[20px] font-bold text-emerald-600 text-center tabular-nums">{buyCount} Orders</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Sell Activity</p>
            <p className="text-[20px] font-bold text-rose-500 text-center tabular-nums">{sellCount} Orders</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Avg. Order</p>
            <p className="text-[20px] font-bold text-black text-center tabular-nums">{formatCurrency(total > 0 ? totalVolume / total : 0)}</p>
          </div>
        </div>

        {/* Transactions Table - Apple High Density Style */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4 text-center">Side</th>
                <th className="px-6 py-4 text-right">Shares</th>
                <th className="px-6 py-4 text-right">Unit Price</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                        <Search className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="font-medium">No transactions found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const logo = transaction.asset.logo;
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50/80 transition-all group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-[13px] font-semibold text-black leading-tight">
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-[11px] text-gray-400 font-medium">
                          {format(new Date(transaction.date), 'HH:mm')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/stock/${transaction.asset.ticker}`} className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                            {logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logo} alt={transaction.asset.ticker} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[11px] font-bold text-gray-800">{transaction.asset.ticker.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-[14px] font-bold text-black leading-tight group-hover:underline underline-offset-2">
                              {transaction.asset.ticker}
                            </p>
                            <p className="text-[11px] text-gray-400 font-medium truncate max-w-[150px]">
                              {transaction.asset.name}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                            transaction.type === 'BUY'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <p className="text-[13px] font-semibold text-black tabular-nums">
                          {formatNumber(transaction.quantity)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <p className="text-[13px] font-medium text-gray-600 tabular-nums">
                          ${transaction.price.toFixed(2)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <p className="text-[14px] font-bold text-black tabular-nums">
                          {formatCurrency(transaction.price * transaction.quantity)}
                        </p>
                        {transaction.fee > 0 && (
                          <p className="text-[10px] text-gray-400 font-medium">
                            Fee: ${transaction.fee.toFixed(2)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 text-gray-400 hover:text-black transition-colors rounded-md hover:bg-gray-100">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded-md hover:bg-rose-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Modern Apple Style */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <p className="text-[13px] font-medium text-gray-400 px-2">
              Showing {((currentPage - 1) * limit) + 1}–{Math.min(currentPage * limit, total)} of {total}
            </p>
            <div className="flex items-center bg-white border border-gray-200 rounded-full p-1 shadow-sm">
              <a
                href={`/transactions?page=${currentPage - 1}${searchParams.ticker ? `&ticker=${searchParams.ticker}` : ''}${searchParams.type ? `&type=${searchParams.type}` : ''}`}
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all ${
                  currentPage <= 1
                    ? 'text-gray-200 cursor-not-allowed'
                    : 'text-gray-600 hover:text-black hover:bg-gray-50'
                }`}
                onClick={(e) => currentPage <= 1 && e.preventDefault()}
              >
                Previous
              </a>
              <div className="w-px h-4 bg-gray-100 mx-1"></div>
              <span className="px-4 py-1.5 text-[13px] font-bold text-black">
                {currentPage} <span className="text-gray-300 font-medium">/</span> {totalPages}
              </span>
              <div className="w-px h-4 bg-gray-100 mx-1"></div>
              <a
                href={`/transactions?page=${currentPage + 1}${searchParams.ticker ? `&ticker=${searchParams.ticker}` : ''}${searchParams.type ? `&type=${searchParams.type}` : ''}`}
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all ${
                  currentPage >= totalPages
                    ? 'text-gray-200 cursor-not-allowed'
                    : 'text-gray-600 hover:text-black hover:bg-gray-50'
                }`}
                onClick={(e) => currentPage >= totalPages && e.preventDefault()}
              >
                Next
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
