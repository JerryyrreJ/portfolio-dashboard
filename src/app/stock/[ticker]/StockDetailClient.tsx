'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Plus,
  ExternalLink, Newspaper, BarChart2, History, ChevronRight,
  Home, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Globe, Search
} from 'lucide-react';
import AddTransactionModal from '@/app/components/AddTransactionModal';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  date: string;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  portfolioName: string;
}

interface ChartPoint {
  date: string;
  price: number;
}

interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  weburl: string;
  finnhubIndustry: string;
}

interface StockMetrics {
  week52High: number;
  week52Low: number;
  peRatio: number;
  eps: number;
  beta: number;
  dividendYield: number;
}

interface NewsArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  datetime: number;
  url: string;
  image: string;
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
  chartData: ChartPoint[];
  transactions: Transaction[];
  portfolioId: string;
  portfolioName: string;
  profile: CompanyProfile | null;
  metrics: StockMetrics | null;
}

// ─── Helper Components ────────────────────────────────────────────────────────

function StatRow({ label, value, highlight, subValue }: { label: string; value: string; highlight?: 'green' | 'red'; subValue?: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 px-1 transition-colors rounded-md group">
      <span className="text-[13px] text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
      <div className="text-right">
        <div className={`text-[15px] font-bold tracking-tight ${
          highlight === 'green' ? 'text-emerald-600' :
          highlight === 'red' ? 'text-rose-500' :
          'text-black'
        }`}>{value}</div>
        {subValue && <div className="text-[11px] text-gray-400 font-medium">{subValue}</div>}
      </div>
    </div>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 p-4 hover:bg-gray-50 transition-all border-b border-gray-50 last:border-0 group"
    >
      {article.image ? (
        <div className="flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-24 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
          <Newspaper className="w-5 h-5 text-gray-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-black text-[14px] leading-tight line-clamp-2 mb-1 group-hover:underline underline-offset-2">
          {article.headline}
        </h4>
        <div className="flex items-center gap-2 text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
          <span>{article.source}</span>
          <span>·</span>
          <span>{new Date(article.datetime * 1000).toLocaleDateString()}</span>
        </div>
      </div>
    </a>
  );
}

const ChartTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-sm">
      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">{label}</p>
      <p className="font-bold text-white text-[15px] tracking-tight tabular-nums">${Number(payload[0].value).toFixed(2)}</p>
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_RANGES = ['1D', '1W', '1M', '3M', '1Y', 'All'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StockDetailClient({ stockData }: { stockData: StockData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('summary');
  const [timeRange, setTimeRange] = useState('1Y');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>(stockData.chartData);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [newsLoaded, setNewsLoaded] = useState(false);

  const {
    ticker, name, market,
    currentPrice, priceChange, priceChangePercent,
    dayHigh, dayLow, dayOpen, prevClose, lastUpdated,
    totalQty, currentValue, costBasis, totalReturn, totalReturnPercent,
    avgBuyPrice, totalFees,
    transactions, portfolioId, portfolioName,
    profile, metrics,
  } = stockData;

  const isUp = priceChange >= 0;
  const isProfit = totalReturn >= 0;

  const fetchChart = useCallback(async (range: string) => {
    setIsChartLoading(true);
    try {
      const res = await fetch(`/api/stock/candles?ticker=${ticker}&range=${range}`);
      const json = await res.json();
      if (json.candles?.s === 'ok' && json.candles.c?.length > 0) {
        const pts: ChartPoint[] = json.candles.c.map((price: number, i: number) => ({
          date: new Date(json.candles.t[i] * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          price,
        }));
        setChartData(pts);
      }
    } catch (e) {
      console.warn('Chart fetch error:', e);
    } finally {
      setIsChartLoading(false);
    }
  }, [ticker]);

  const fetchNews = useCallback(async () => {
    if (newsLoaded) return;
    setIsNewsLoading(true);
    try {
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(`/api/stock/news?symbol=${ticker}&from=${from}&to=${to}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setNews(data.filter((a: NewsArticle) => a.headline).slice(0, 10));
        setNewsLoaded(true);
      }
    } catch (e) {
      console.warn('News fetch error:', e);
    } finally {
      setIsNewsLoading(false);
    }
  }, [ticker, newsLoaded]);

  useEffect(() => {
    if (timeRange !== '1Y') fetchChart(timeRange);
    else setChartData(stockData.chartData);
  }, [timeRange, fetchChart, stockData.chartData]);

  useEffect(() => { if (activeTab === 'news') fetchNews(); }, [activeTab, fetchNews]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const prices = chartData.map((d) => d.price);
  const chartMin = prices.length ? Math.min(...prices) * 0.98 : 0;
  const chartMax = prices.length ? Math.max(...prices) * 1.02 : 100;

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">
      
      {/* 顶部导航栏 - 同步首页 */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight">
            <div className="bg-black text-white p-1 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span>PortfolioUI</span>
          </Link>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-400">
            <Link href="/" className="hover:text-black transition-colors py-[16px]">Investments</Link>
            <Link href="/transactions" className="hover:text-black transition-colors py-[16px]">Transactions</Link>
            <a href="#" className="hover:text-black transition-colors py-[16px]">History</a>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-gray-400" />
            <input type="text" placeholder="Search" className="bg-gray-100 border-none rounded-lg py-1.5 pl-9 pr-4 text-[13px] w-44 focus:w-60 focus:ring-1 focus:ring-black/5 focus:bg-white transition-all duration-300" />
          </div>
          <div className="flex items-center space-x-2 text-[14px] font-semibold cursor-pointer text-gray-500 hover:text-black">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[11px] text-gray-500">JD</div>
            <span>Account</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-6 py-6">
        
        {/* Header: Logo, Name, Price & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[18px] bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile?.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.logo} alt={ticker} className="w-10 h-10 object-contain" />
              ) : (
                <span className="text-2xl font-bold text-gray-800">{ticker.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-[13px] font-bold uppercase tracking-widest mb-1">
                <Link href="/" className="hover:text-black">Dashboard</Link>
                <ChevronRight className="w-3 h-3" />
                <span>{market}</span>
              </div>
              <h1 className="text-[32px] font-bold text-black tracking-tight leading-none flex items-center gap-3">
                {ticker}
                <span className="text-gray-300 font-light">|</span>
                <span className="text-[20px] text-gray-500 font-medium">{name}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-right">
              <div className="flex items-center justify-end gap-3">
                <span className="text-[36px] font-bold text-black tracking-tighter tabular-nums leading-none">${currentPrice.toFixed(2)}</span>
                <button onClick={handleRefresh} className="p-1.5 text-gray-400 hover:text-black transition-colors rounded-lg border border-gray-100 hover:border-gray-200">
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className={`flex items-center justify-end gap-1.5 mt-1 font-bold ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span className="text-[17px] tracking-tight tabular-nums">{Math.abs(priceChange).toFixed(2)} ({priceChangePercent.toFixed(2)}%)</span>
              </div>
            </div>
            <div className="h-12 w-px bg-gray-100 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsAddTradeOpen(true)} className="px-5 py-2 bg-black text-white text-[14px] font-bold rounded-xl hover:bg-gray-800 transition-all shadow-md flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Trade
              </button>
            </div>
          </div>
        </div>

        {/* Grid Layout: Main info & Sidebar */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* Main Content Area */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            
            {/* Chart Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[15px] font-bold text-black tracking-tight uppercase tracking-widest">Price History</h3>
                <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                  {TIME_RANGES.map((r) => (
                    <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${timeRange === r ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-black'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[280px] relative">
                {isChartLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-xl"><RefreshCw className="w-6 h-6 animate-spin text-gray-300" /></div>}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isUp ? '#34C759' : '#FF3B30'} stopOpacity={0.1}/>
                        <stop offset="95%" stopColor={isUp ? '#34C759' : '#FF3B30'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }} width={60} domain={[chartMin, chartMax]} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#eee', strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="price" stroke={isUp ? '#34C759' : '#FF3B30'} strokeWidth={2.5} fill="url(#colorPrice)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: isUp ? '#34C759' : '#FF3B30' }} />
                    {avgBuyPrice > 0 && avgBuyPrice >= chartMin && avgBuyPrice <= chartMax && (
                      <ReferenceLine y={avgBuyPrice} stroke="#000" strokeDasharray="4 4" strokeWidth={1} label={{ value: `AVG $${avgBuyPrice.toFixed(2)}`, fill: '#888', fontSize: 9, fontWeight: 'bold', position: 'insideBottomRight' }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-50 px-2">
                {[
                  { id: 'summary', label: 'Overview', icon: BarChart2 },
                  { id: 'news', label: 'News Feed', icon: Newspaper },
                  { id: 'trades', label: 'Transaction Log', icon: History },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-4 text-[13px] font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === tab.id ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black'}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-0">
                {activeTab === 'summary' && (
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Market Metrics</h4>
                        <StatRow label="Open" value={`$${dayOpen.toFixed(2)}`} />
                        <StatRow label="Prev Close" value={`$${prevClose.toFixed(2)}`} />
                        <StatRow label="Day Range" value={`$${dayLow.toFixed(2)} – $${dayHigh.toFixed(2)}`} />
                        {metrics && <StatRow label="52W Range" value={`$${metrics.week52Low.toFixed(2)} – $${metrics.week52High.toFixed(2)}`} />}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Key Statistics</h4>
                        {metrics && (
                          <>
                            <StatRow label="P/E Ratio" value={metrics.peRatio.toFixed(2)} />
                            <StatRow label="Dividend Yield" value={`${metrics.dividendYield.toFixed(2)}%`} />
                            <StatRow label="Beta" value={metrics.beta.toFixed(2)} />
                            {profile?.marketCapitalization && <StatRow label="Market Cap" value={`$${(profile.marketCapitalization / 1000).toFixed(2)}B`} />}
                          </>
                        )}
                      </div>
                    </div>
                    {profile && (
                      <div className="mt-8 pt-6 border-t border-gray-50">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Company Profile</h4>
                        <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                          <StatRow label="Industry" value={profile.finnhubIndustry} />
                          <StatRow label="Exchange" value={profile.exchange} />
                          <StatRow label="Country" value={profile.country} />
                          <StatRow label="IPO Date" value={profile.ipo} />
                        </div>
                        <div className="mt-4 flex items-center gap-4">
                          {profile.weburl && (
                            <a href={profile.weburl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] font-bold text-black hover:underline underline-offset-4">
                              <Globe className="w-3.5 h-3.5" /> Official Website
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'news' && (
                  <div className="divide-y divide-gray-50">
                    {isNewsLoading ? <div className="py-20 text-center"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-200" /></div> : news.map(a => <NewsCard key={a.id} article={a} />)}
                  </div>
                )}

                {activeTab === 'trades' && (
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3 text-right">Shares</th>
                        <th className="px-6 py-3 text-right">Price</th>
                        <th className="px-6 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[13px]">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 font-semibold">{new Date(tx.date).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${tx.type === 'BUY' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{tx.type}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium tabular-nums">{tx.quantity.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-medium tabular-nums">${tx.price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right font-bold tabular-nums">${(tx.price * tx.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            
            {/* Position Summary Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                <Wallet className="w-16 h-16 text-black" />
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Your Position</p>
              <div className="text-[32px] font-bold tracking-tight mb-5 tabular-nums text-black">
                ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[13px] bg-gray-50/80 p-2.5 rounded-lg border border-gray-100/50">
                  <span className="text-gray-500 font-semibold">Total Shares</span>
                  <span className="font-bold text-black tabular-nums">{totalQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] bg-gray-50/80 p-2.5 rounded-lg border border-gray-100/50">
                  <span className="text-gray-500 font-semibold">Avg. Cost</span>
                  <span className="font-bold text-black tabular-nums">${avgBuyPrice.toFixed(2)}</span>
                </div>
                
                <div className={`mt-2 p-3 rounded-xl border ${isProfit ? 'bg-emerald-50/50 border-emerald-100/50' : 'bg-rose-50/50 border-rose-100/50'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-[12px] font-bold uppercase tracking-wider ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Total Return
                    </span>
                    <div className="text-right">
                      <div className={`text-[16px] font-bold tracking-tight tabular-nums ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isProfit ? '+' : '-'}${Math.abs(totalReturn).toFixed(2)}
                      </div>
                      <div className={`text-[11px] font-bold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isProfit ? '+' : ''}{totalReturnPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Investment Details</h4>
              <StatRow label="Cost Basis" value={`$${costBasis.toFixed(2)}`} />
              <StatRow label="Brokerage" value={`$${totalFees.toFixed(2)}`} />
              {metrics && <StatRow label="Dividend Yield" value={`${metrics.dividendYield.toFixed(2)}%`} />}
            </div>

            {/* Market Status Bar */}
            <div className="bg-gray-100/50 rounded-2xl p-5 border border-gray-100 text-center">
              <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                Market Data Live
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-1">Last synced {new Date(lastUpdated).toLocaleTimeString()}</p>
            </div>

          </div>
        </div>
      </main>

      {portfolioId && (
        <AddTransactionModal
          isOpen={isAddTradeOpen}
          onClose={() => setIsAddTradeOpen(false)}
          portfolioName={portfolioName}
          portfolioId={portfolioId}
        />
      )}
    </div>
  );
}