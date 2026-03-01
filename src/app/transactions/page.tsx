import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Filter, Download, TrendingUp, TrendingDown, Search } from 'lucide-react';

const prisma = new PrismaClient();

interface TransactionWithAsset {
  id: number;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  date: Date;
  notes: string | null;
  asset: {
    ticker: string;
    name: string;
    market: string;
  };
}

async function getTransactions(
  portfolioId: number,
  searchParams: { [key: string]: string | undefined }
): Promise<{ transactions: TransactionWithAsset[]; total: number }> {
  const page = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const ticker = searchParams.ticker;
  const type = searchParams.type;
  const startDate = searchParams.startDate;
  const endDate = searchParams.endDate;

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

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      where.date.lte = new Date(endDate);
    }
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

// 获取投资组合列表（用于筛选）
async function getPortfolios() {
  const portfolios = await prisma.portfolio.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      id: 'asc',
    },
  });
  return portfolios;
}

// 格式化金额
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// 格式化数字
function formatNumber(num: number, decimals: number = 4): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  // 获取第一个投资组合（暂时简化处理）
  const portfolios = await getPortfolios();
  const defaultPortfolioId = portfolios[0]?.id || 1;

  const { transactions, total } = await getTransactions(defaultPortfolioId, searchParams);

  const currentPage = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
                <p className="text-sm text-gray-500">
                  {total} transactions • Page {currentPage} of {totalPages}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Buy Orders</p>
            <p className="text-2xl font-bold text-green-600">
              {transactions.filter(t => t.type === 'BUY').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Sell Orders</p>
            <p className="text-2xl font-bold text-red-600">
              {transactions.filter(t => t.type === 'SELL').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Total Volume</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(transactions.reduce((sum, t) => sum + (t.price * t.quantity), 0))}
            </p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 text-gray-300" />
                      <p>No transactions found</p>
                      <p className="text-sm text-gray-400">Start by adding your first transaction</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(transaction.date), 'HH:mm')}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-indigo-600">
                            {transaction.asset.ticker.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {transaction.asset.ticker}
                          </p>
                          <p className="text-xs text-gray-500 truncate max-w-[150px]">
                            {transaction.asset.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.type === 'BUY'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {transaction.type === 'BUY' ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {formatNumber(transaction.quantity)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <p className="text-sm text-gray-900">
                        {formatCurrency(transaction.price)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(transaction.price * transaction.quantity)}
                      </p>
                      {transaction.fee > 0 && (
                        <p className="text-xs text-gray-500">
                          Fee: {formatCurrency(transaction.fee)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500">
              Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, total)} of {total} transactions
            </p>
            <div className="flex items-center gap-2">
              <a
                href={`/transactions?page=${currentPage - 1}${searchParams.ticker ? `&ticker=${searchParams.ticker}` : ''}${searchParams.type ? `&type=${searchParams.type}` : ''}`}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  currentPage <= 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={(e) => currentPage <= 1 && e.preventDefault()}
              >
                Previous
              </a>
              <span className="px-3 py-2 text-sm font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <a
                href={`/transactions?page=${currentPage + 1}${searchParams.ticker ? `&ticker=${searchParams.ticker}` : ''}${searchParams.type ? `&type=${searchParams.type}` : ''}`}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  currentPage >= totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
