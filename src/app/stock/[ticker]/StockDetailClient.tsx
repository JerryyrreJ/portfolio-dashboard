"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Clock,
  BarChart3,
  ChevronDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  MoreHorizontal,
  Settings,
  FileText,
  History,
  PieChart
} from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  portfolioName: string;
}

interface ChartDataPoint {
  date: string;
  price: number;
}

interface StockData {
  ticker: string;
  name: string;
  market: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  prevClose: number;
  lastUpdated: Date;
  totalQty: number;
  currentValue: number;
  costBasis: number;
  totalReturn: number;
  totalReturnPercent: number;
  avgBuyPrice: number;
  totalFees: number;
  chartData: ChartDataPoint[];
  transactions: Transaction[];
}

interface StockDetailClientProps {
  stockData: StockData;
}

const TABS = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'trades', label: 'Trades & Income', icon: History },
  { id: 'notes', label: 'Notes & Files', icon: FileText },
  { id: 'news', label: 'News', icon: Info },
];

const TIME_RANGES = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' },
];

export default function StockDetailClient({ stockData }: StockDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('summary');
  const [timeRange, setTimeRange] = useState('1y');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const {
    ticker,
    name,
    market,
    currentPrice,
    priceChange,
    priceChangePercent,
    dayHigh,
    dayLow,
    dayOpen,
    prevClose,
    lastUpdated,
    totalQty,
    currentValue,
    costBasis,
    totalReturn,
    totalReturnPercent,
    avgBuyPrice,
    totalFees,
    chartData,
    transactions
  } = stockData;

  const isPositiveChange = priceChange >= 0;
  const isPositiveReturn = totalReturn >= 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const displayedTransactions = showAllTransactions
    ? transactions
    : transactions.slice(0, 5);

  // 计算52周高低（基于图表数据）
  const prices = chartData.map(d => d.price);
  const week52High = prices.length > 0 ? Math.max(...prices) : dayHigh;
  const week52Low = prices.length > 0 ? Math.min(...prices) : dayLow;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <nav className="flex items-center text-sm text-gray-500">
                <span>Investments</span>
                <span className="mx-2">›</span>
                <span className="font-medium text-gray-900">{ticker}</span>
              </nav>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                className={`p-2 text-gray-400 hover:text-gray-600 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stock Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {ticker.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {ticker} | {market}
                </h1>
                <p className="text-gray-500 mt-1">{name}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-sm text-gray-400">
                    Updated: {new Date().toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                US${currentPrice.toFixed(2)}
              </div>
              <div className={`flex items-center justify-end space-x-2 mt-1 ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
                {isPositiveChange ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span className="text-lg font-medium">
                  {isPositiveChange ? '+' : ''}{priceChange.toFixed(2)} ({isPositiveChange ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center space-x-1 mt-6 border-b border-gray-200">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <div className="flex-1"></div>
            <button className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
              <Settings className="w-4 h-4" />
              <span>Edit holding</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart & Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Price Performance</h3>
                  <p className="text-sm text-gray-500">Historical price movement</p>
                </div>
                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                  {TIME_RANGES.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setTimeRange(range.value)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        timeRange === range.value
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositiveChange ? '#10b981' : '#ef4444'} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={isPositiveChange ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: 'white'
                      }}
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={isPositiveChange ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      fill="url(#colorPrice)"
                    />
                    <ReferenceLine
                      y={avgBuyPrice}
                      stroke="#6366f1"
                      strokeDasharray="5 5"
                      label={{ value: 'Avg Buy', fill: '#6366f1', fontSize: 12 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center justify-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isPositiveChange ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-gray-600">Current Price</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-sm text-gray-600">Your Avg Buy Price</span>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Total Return</p>
                  <p className={`text-xl font-bold ${isPositiveReturn ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositiveReturn ? '+' : ''}{totalReturnPercent.toFixed(2)}%
                  </p>
                  <p className={`text-sm ${isPositiveReturn ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositiveReturn ? '+' : '-'}${Math.abs(totalReturn).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Capital Gain</p>
                  <p className={`text-xl font-bold ${isPositiveReturn ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositiveReturn ? '+' : ''}{totalReturnPercent.toFixed(2)}%
                  </p>
                  <p className={`text-sm ${isPositiveReturn ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositiveReturn ? '+' : '-'}${Math.abs(totalReturn).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Dividends</p>
                  <p className="text-xl font-bold text-gray-900">0.00%</p>
                  <p className="text-sm text-gray-500">$0.00</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Total Cost</p>
                  <p className="text-xl font-bold text-gray-900">${costBasis.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Fees: ${totalFees.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
                <span className="text-sm text-gray-500">{transactions.length} transactions</span>
              </div>

              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="py-3">Date</th>
                      <th className="py-3">Type</th>
                      <th className="py-3 text-right">Quantity</th>
                      <th className="py-3 text-right">Price</th>
                      <th className="py-3 text-right">Fee</th>
                      <th className="py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedTransactions.map((tx) => {
                      const isBuy = tx.type === 'BUY';
                      const total = isBuy
                        ? (tx.price * tx.quantity) + tx.fee
                        : (tx.price * tx.quantity) - tx.fee;
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 text-sm text-gray-900">
                            {new Date(tx.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isBuy
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {isBuy ? 'Buy' : 'Sell'}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            {tx.quantity.toFixed(4).replace(/\.?0+$/, '')}
                          </td>
                          <td className="py-3 text-sm text-gray-900 text-right">
                            ${tx.price.toFixed(2)}
                          </td>
                          <td className="py-3 text-sm text-gray-500 text-right">
                            ${tx.fee.toFixed(2)}
                          </td>
                          <td className="py-3 text-sm font-medium text-right">
                            <span className={isBuy ? 'text-red-600' : 'text-green-600'}>
                              {isBuy ? '-' : '+'}${Math.abs(total).toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {transactions.length > 5 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowAllTransactions(!showAllTransactions)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      {showAllTransactions ? 'Show Less' : `Show All ${transactions.length} Transactions`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-6">
            {/* Current Value Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Current Value</h3>
              <div className="text-3xl font-bold text-gray-900">
                US${currentValue.toFixed(2)}
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Price</span>
                  <span className="text-sm font-medium text-gray-900">US${currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Qty</span>
                  <span className="text-sm font-medium text-gray-900">{totalQty.toFixed(4).replace(/\.?0+$/, '')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-sm font-bold text-gray-900">US${currentValue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Price Comparison */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Price Comparison</h3>

              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Current vs Avg Buy</span>
                  <span className={`font-medium ${currentPrice >= avgBuyPrice ? 'text-green-600' : 'text-red-600'}`}>
                    {((currentPrice / avgBuyPrice - 1) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${Math.min(Math.max((currentPrice / (avgBuyPrice * 1.5)) * 100, 0), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1 text-gray-400">
                  <span>$0</span>
                  <span>${avgBuyPrice.toFixed(2)} (avg)</span>
                  <span>${(avgBuyPrice * 1.5).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-gray-600">Current price</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">US${currentPrice.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-sm text-gray-600">Your avg buy price</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">US${avgBuyPrice.toFixed(3)}</span>
                </div>
              </div>
            </div>

            {/* Your Investment */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Your Investment</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Current value</span>
                  <span className="text-sm font-bold text-gray-900">US${currentValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total quantity</span>
                  <span className="text-sm font-medium text-gray-900">{totalQty.toFixed(4).replace(/\.?0+$/, '')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Cost basis</span>
                  <span className="text-sm font-medium text-gray-900">US${costBasis.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <span className="text-sm text-gray-600">Cost basis per share</span>
                  <span className="text-sm font-medium text-gray-900">US${avgBuyPrice.toFixed(3)}</span>
                </div>
              </div>
            </div>

            {/* Market Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Market Stats</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Day High</p>
                  <p className="text-sm font-semibold text-gray-900">${dayHigh.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Day Low</p>
                  <p className="text-sm font-semibold text-gray-900">${dayLow.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Open</p>
                  <p className="text-sm font-semibold text-gray-900">${dayOpen.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Prev Close</p>
                  <p className="text-sm font-semibold text-gray-900">${prevClose.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
