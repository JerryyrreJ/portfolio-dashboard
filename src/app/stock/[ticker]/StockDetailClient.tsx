'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Plus,
  ExternalLink, Newspaper, BarChart2, History, ChevronRight,
  Home, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Globe, Search, User
} from 'lucide-react';
import AddTransactionModal from '@/app/components/AddTransactionModal';
import Link from 'next/link';
import Image from 'next/image';
import { useCurrency } from '@/lib/useCurrency';

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

const ChartTooltip = ({ active, payload, label, fmt }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  fmt?: (n: number) => string;
}) => {
  if (!active || !payload || !payload.length) return null;
  const display = fmt ? fmt(Number(payload[0].value)) : `$${Number(payload[0].value).toFixed(2)}`;
  return (
    <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-sm">
      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">{label}</p>
      <p className="font-bold text-white text-[15px] tracking-tight tabular-nums">{display}</p>
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_RANGES = ['1D', '1W', '1M', '3M', '1Y', 'All'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StockDetailClient({ stockData }: { stockData: StockData }) {
  const router = useRouter();
  const { fmt, symbol, convert } = useCurrency();
  const [activeTab, setActiveTab] = useState('summary');
  const [timeRange, setTimeRange] = useState('1Y');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>(stockData.chartData);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [newsLoaded, setNewsLoaded] = useState(false);
  const hasSynced = useRef(false);

  const {
    ticker, name, market,
    currentPrice, priceChange, priceChangePercent,
    dayHigh, dayLow, dayOpen, prevClose, lastUpdated,
    totalQty, currentValue, costBasis, totalReturn, totalReturnPercent,
    avgBuyPrice, totalFees,
    transactions, portfolioId, portfolioName,
    profile, metrics,
  } = stockData;

  const lastUpdatedMs = lastUpdated instanceof Date ? lastUpdated.getTime() : Number(lastUpdated);

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

  // Background Sync Effect (Stale-While-Revalidate)
  useEffect(() => {
    if (hasSynced.current) return;

    const checkAndSyncData = async () => {
      if (!lastUpdatedMs) return;

      const diffMinutes = (Date.now() - lastUpdatedMs) / (1000 * 60);

      // If data is older than 60 minutes, sync silently
      if (diffMinutes > 60) {
        hasSynced.current = true;
        try {
          console.log('Data is stale. Syncing silently in background...');
          const res = await fetch(`/api/assets/${ticker}/sync`, { method: 'POST' });
          if (res.ok) {
            router.refresh();
          }
        } catch (error) {
          hasSynced.current = false;
          console.error('Background sync failed:', error);
        }
      }
    };

    checkAndSyncData();
  }, [lastUpdatedMs, ticker, router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`/api/assets/${ticker}/sync`, { method: 'POST' });
      router.refresh();
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const prices = chartData.map((d) => d.price);
  const chartMin = prices.length ? Math.min(...prices) * 0.98 : 0;
  const chartMax = prices.length ? Math.max(...prices) * 1.02 : 100;

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">
      
      {/* 顶部导航栏 - 同步首页 */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-4 sm:px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight">
            <div className="bg-black text-white p-1 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span>Folio</span>
          </Link>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-400">
            <Link href="/" className="hover:text-black transition-colors py-[16px]">Investments</Link>
            <Link href="/transactions" className="hover:text-black transition-colors py-[16px]">Transactions</Link>
            <a href="#" className="hover:text-black transition-colors py-[16px]">History</a>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-gray-400" />
            <input type="text" placeholder="Search" className="bg-gray-100 border-none rounded-lg py-1.5 pl-9 pr-4 text-[13px] w-44 focus:w-60 focus:ring-1 focus:ring-black/5 focus:bg-white transition-all duration-300" />
          </div>
          <Link 
            href="/settings"
            className="flex items-center space-x-2.5 group transition-all shrink-0"
          >
            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 group-hover:border-gray-400 group-hover:text-black transition-colors shadow-sm overflow-hidden">
              <User className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-bold text-gray-500 group-hover:text-black transition-colors hidden sm:block">Account</span>
          </Link>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        
        {/* Header: Logo, Name, Price & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-6 sm:gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 mt-1 sm:mt-0">
              {profile?.logo ? (
                <Image 
                  src={profile.logo} 
                  alt={ticker} 
                  width={64} 
                  height={64} 
                  className="w-full h-full object-cover"
                  unoptimized={true}
                />
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-gray-800">{ticker.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 text-gray-400 text-[11px] sm:text-[13px] font-bold uppercase tracking-widest mb-1 truncate">
                <Link href="/" className="hover:text-black shrink-0">Dashboard</Link>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className="truncate">{market}</span>
              </div>
              <h1 className="text-[24px] sm:text-[32px] font-bold text-black tracking-tight leading-none flex flex-wrap items-baseline gap-2 sm:gap-3">
                <span>{ticker}</span>
                <span className="text-gray-300 font-light hidden sm:inline-block">|</span>
                <span className="text-[16px] sm:text-[20px] text-gray-500 font-medium truncate w-full sm:w-auto mt-1 sm:mt-0">{name}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 w-full sm:w-auto bg-white sm:bg-transparent p-4 sm:p-0 rounded-2xl sm:rounded-none border sm:border-none border-gray-100 shadow-sm sm:shadow-none">
            <div className="text-left sm:text-right">
              <div className="flex items-center justify-start sm:justify-end gap-2 sm:gap-3">
                <span className="text-[28px] sm:text-[36px] font-bold text-black tracking-tighter tabular-nums leading-none">{fmt(currentPrice)}</span>
                <button onClick={handleRefresh} className="p-1 sm:p-1.5 text-gray-400 hover:text-black transition-colors rounded-lg border border-gray-100 hover:border-gray-200">
                  <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className={`flex items-center justify-start sm:justify-end gap-1.5 mt-1 font-bold ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                {isUp ? <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                <span className="text-[15px] sm:text-[17px] tracking-tight tabular-nums">{fmt(Math.abs(priceChange))} ({priceChangePercent.toFixed(2)}%)</span>
              </div>
            </div>
            <div className="h-10 w-px bg-gray-100 hidden sm:block"></div>
            <div className="flex items-center shrink-0">
              <button onClick={() => setIsAddTradeOpen(true)} className="px-4 py-3 sm:px-5 sm:py-2 bg-black text-white text-[13px] sm:text-[14px] font-bold rounded-xl hover:bg-gray-800 transition-all shadow-md flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline-block">Add Trade</span><span className="sm:hidden">Trade</span>
              </button>
            </div>
          </div>
        </div>

        {/* Grid Layout: Main info & Sidebar */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* Main Content Area */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            
            {/* Chart Section */}
            <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-gray-100 shadow-sm p-4 sm:p-8 pb-4 relative overflow-hidden group/chart">
              <div className="flex justify-between items-center mb-6 sm:mb-10">
                <div>
                  <h3 className="text-[15px] sm:text-[16px] font-bold text-black tracking-tight flex items-center gap-2">
                    Performance
                    <span className="text-[10px] font-bold text-gray-400 px-2 py-0.5 bg-gray-50 rounded-full border border-gray-100 uppercase tracking-widest hidden sm:inline-block">12 Months</span>
                  </h3>
                </div>
              </div>
              
              <div className="h-[280px] sm:h-[340px] w-full -ml-4 sm:-ml-6 relative">
                {isChartLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px] z-20 transition-all duration-500">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-black/20" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Updating Market Data</span>
                    </div>
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity={0.12}/>
                        <stop offset="95%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f8f8f8" strokeWidth={1} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                      dy={15}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      hide={true}
                      domain={[chartMin * 0.98, chartMax * 1.02]} 
                    />
                    <Tooltip
                      content={<ChartTooltip fmt={fmt} />}
                      cursor={{ stroke: '#f1f1f1', strokeWidth: 1.5 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke={isUp ? '#10b981' : '#f43f5e'} 
                      strokeWidth={3} 
                      fill="url(#colorPrice)" 
                      dot={false} 
                      activeDot={{ r: 5, strokeWidth: 0, fill: isUp ? '#10b981' : '#f43f5e' }}
                      animationDuration={1500}
                    />
                    {avgBuyPrice > 0 && avgBuyPrice >= chartMin * 0.9 && avgBuyPrice <= chartMax * 1.1 && (
                      <ReferenceLine 
                        y={avgBuyPrice} 
                        stroke="#000" 
                        strokeDasharray="6 6" 
                        strokeWidth={1} 
                        strokeOpacity={0.15}
                        label={{ 
                          value: `AVG ${fmt(avgBuyPrice)}`,
                          fill: '#94a3b8', 
                          fontSize: 9, 
                          fontWeight: 700, 
                          position: 'insideBottomRight',
                          offset: 10
                        }} 
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-50 px-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'summary', label: 'Overview', icon: BarChart2 },
                  { id: 'news', label: 'News Feed', icon: Newspaper },
                  { id: 'trades', label: 'Transaction Log', icon: History },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 sm:px-6 py-4 text-[12px] sm:text-[13px] font-bold uppercase tracking-widest transition-colors border-b-2 whitespace-nowrap shrink-0 ${activeTab === tab.id ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black'}`}>
                    <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-0">
                {activeTab === 'summary' && (
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 sm:gap-y-2">
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Market Metrics</h4>
                        <StatRow label="Open" value={dayOpen > 0 ? fmt(dayOpen) : '--'} />
                        <StatRow label="Prev Close" value={prevClose > 0 ? fmt(prevClose) : '--'} />
                        <StatRow label="Day Range" value={dayLow > 0 && dayHigh > 0 ? `${fmt(dayLow)} – ${fmt(dayHigh)}` : '--'} />
                        <StatRow label="52W Range" value={metrics && metrics.week52Low > 0 && metrics.week52High > 0 ? `${fmt(metrics.week52Low)} – ${fmt(metrics.week52High)}` : '--'} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Key Statistics</h4>
                        <StatRow label="P/E Ratio" value={metrics && metrics.peRatio > 0 ? metrics.peRatio.toFixed(2) : '--'} />
                        <StatRow label="EPS (TTM)" value={metrics && metrics.eps !== 0 ? metrics.eps.toFixed(2) : '--'} />
                        <StatRow label="Dividend Yield" value={metrics && metrics.dividendYield > 0 ? `${metrics.dividendYield.toFixed(2)}%` : '--'} />
                        <StatRow label="Beta" value={metrics && metrics.beta > 0 ? metrics.beta.toFixed(2) : '--'} />
                        <StatRow label="Market Cap" value={profile?.marketCapitalization && profile.marketCapitalization > 0 ? `${symbol}${(convert(profile.marketCapitalization) / 1000).toFixed(2)}B` : '--'} />
                      </div>
                    </div>
                    {profile && (
                      <div className="mt-8 pt-6 border-t border-gray-50">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Company Profile</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-2">
                          <StatRow label="Industry" value={profile.finnhubIndustry || '--'} />
                          <StatRow label="Exchange" value={profile.exchange || '--'} />
                          <StatRow label="Country" value={profile.country || '--'} />
                          <StatRow label="IPO Date" value={profile.ipo || '--'} />
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
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[500px]">
                      <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-4 sm:px-6 py-3">Date</th>
                          <th className="px-4 sm:px-6 py-3">Type</th>
                          <th className="px-4 sm:px-6 py-3 text-right">Shares</th>
                          <th className="px-4 sm:px-6 py-3 text-right">Price</th>
                          <th className="px-4 sm:px-6 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-[13px]">
                        {transactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50/50">
                            <td className="px-4 sm:px-6 py-4 font-semibold">{new Date(tx.date).toLocaleDateString()}</td>
                            <td className="px-4 sm:px-6 py-4">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${tx.type === 'BUY' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{tx.type}</span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-right font-medium tabular-nums">{tx.quantity.toLocaleString()}</td>
                            <td className="px-4 sm:px-6 py-4 text-right font-medium tabular-nums">{fmt(tx.price)}</td>
                            <td className="px-4 sm:px-6 py-4 text-right font-bold tabular-nums">{fmt(tx.price * tx.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                {fmt(currentValue)}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[13px] bg-gray-50/80 p-2.5 rounded-lg border border-gray-100/50">
                  <span className="text-gray-500 font-semibold">Total Shares</span>
                  <span className="font-bold text-black tabular-nums">{totalQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] bg-gray-50/80 p-2.5 rounded-lg border border-gray-100/50">
                  <span className="text-gray-500 font-semibold">Avg. Cost</span>
                  <span className="font-bold text-black tabular-nums">{fmt(avgBuyPrice)}</span>
                </div>
                
                <div className={`mt-2 p-3 rounded-xl border ${isProfit ? 'bg-emerald-50/50 border-emerald-100/50' : 'bg-rose-50/50 border-rose-100/50'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-[12px] font-bold uppercase tracking-wider ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Total Return
                    </span>
                    <div className="text-right">
                      <div className={`text-[16px] font-bold tracking-tight tabular-nums ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isProfit ? '+' : '-'}{fmt(Math.abs(totalReturn))}
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
              <StatRow label="Cost Basis" value={fmt(costBasis)} />
              <StatRow label="Brokerage" value={fmt(totalFees)} />
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