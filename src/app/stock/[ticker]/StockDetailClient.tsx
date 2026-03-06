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
  Home, DollarSign,
} from 'lucide-react';
import AddTransactionModal from '@/app/components/AddTransactionModal';

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

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'red' }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${
        highlight === 'green' ? 'text-emerald-600' :
        highlight === 'red' ? 'text-red-500' :
        'text-gray-900'
      }`}>{value}</span>
    </div>
  );
}

function PriceComparisonBar({
  currentPrice,
  avgBuyPrice,
}: {
  currentPrice: number;
  avgBuyPrice: number;
}) {
  const max = Math.max(currentPrice, avgBuyPrice) * 1.15;
  const currentPct = Math.min((currentPrice / max) * 100, 100);
  const avgPct = Math.min((avgBuyPrice / max) * 100, 100);
  const isAbove = currentPrice >= avgBuyPrice;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Current price</span>
          <span className="font-semibold text-gray-800">${currentPrice.toFixed(2)}</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isAbove ? 'bg-amber-400' : 'bg-rose-400'}`}
            style={{ width: `${currentPct}%` }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Your avg buy price</span>
          <span className="font-semibold text-gray-800">${avgBuyPrice.toFixed(2)}</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-rose-500 transition-all duration-700"
            style={{ width: `${avgPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const d = Math.floor(seconds / 86400);
  if (d < 7) return `${d}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-gray-100 last:border-0 group"
    >
      {article.image ? (
        <div className="flex-shrink-0 w-20 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-20 h-16 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Newspaper className="w-6 h-6 text-indigo-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-indigo-700 transition-colors">
          {article.headline}
        </h4>
        {article.summary && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{article.summary}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-medium text-gray-500">{article.source}</span>
          <span>·</span>
          <span>{getTimeAgo(article.datetime)}</span>
          <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
        </div>
      </div>
    </a>
  );
}

function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
}

// Custom tooltip for the chart
const ChartTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="font-bold text-gray-900 text-base">${Number(payload[0].value).toFixed(2)}</p>
    </div>
  );
};

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'summary', label: 'Summary', icon: BarChart2 },
  { id: 'trades', label: 'Trades & Income', icon: History },
  { id: 'news', label: 'News', icon: Newspaper },
];

const TIME_RANGES = ['1D', '1W', '1M', '3M', '1Y', 'All'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StockDetailClient({ stockData }: { stockData: StockData }) {
  const router = useRouter();

  // UI state
  const [activeTab, setActiveTab] = useState('summary');
  const [timeRange, setTimeRange] = useState('1Y');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);

  // Chart state (client-side fetching for different ranges)
  const [chartData, setChartData] = useState<ChartPoint[]>(stockData.chartData);
  const [isChartLoading, setIsChartLoading] = useState(false);

  // News state
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

  // Fetch chart data when time range changes (1Y is server-rendered)
  const fetchChart = useCallback(async (range: string) => {
    setIsChartLoading(true);
    try {
      const res = await fetch(`/api/stock/candles?ticker=${ticker}&range=${range}`);
      const json = await res.json();
      if (json.candles?.s === 'ok' && json.candles.c?.length > 0) {
        const isIntraday = range === '1D';
        const pts: ChartPoint[] = json.candles.c.map((price: number, i: number) => ({
          date: new Date(json.candles.t[i] * 1000).toLocaleDateString('en-US',
            isIntraday
              ? { hour: '2-digit', minute: '2-digit' }
              : { month: 'short', day: 'numeric' }
          ),
          price,
        }));
        setChartData(pts);
      }
    } catch (e) {
      console.error('Chart fetch error:', e);
    } finally {
      setIsChartLoading(false);
    }
  }, [ticker]);

  // Fetch news when news tab opens
  const fetchNews = useCallback(async () => {
    if (newsLoaded) return;
    setIsNewsLoading(true);
    try {
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(`/api/stock/news?symbol=${ticker}&from=${from}&to=${to}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setNews(data.filter((a: NewsArticle) => a.headline).slice(0, 12));
        setNewsLoaded(true);
      }
    } catch (e) {
      console.error('News fetch error:', e);
    } finally {
      setIsNewsLoading(false);
    }
  }, [ticker, newsLoaded]);

  useEffect(() => {
    if (timeRange !== '1Y') fetchChart(timeRange);
    else setChartData(stockData.chartData);
  }, [timeRange, fetchChart, stockData.chartData]);

  useEffect(() => {
    if (activeTab === 'news') fetchNews();
  }, [activeTab, fetchNews]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const visibleTrades = showAllTrades ? transactions : transactions.slice(0, 8);

  // Chart domain padding
  const prices = chartData.map((d) => d.price);
  const chartMin = prices.length ? Math.min(...prices) * 0.97 : 0;
  const chartMax = prices.length ? Math.max(...prices) * 1.03 : 100;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky Top Nav ──────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-2 text-sm">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <Home className="w-4 h-4" />
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-900 transition-colors"
          >
            {portfolioName || 'Portfolio'}
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="font-semibold text-gray-900">{ticker}</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Stock Header ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">

            {/* Left: Logo + Title */}
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 shadow-inner flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.logo}
                    alt={ticker}
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      el.style.display = 'none';
                      if (el.parentElement) {
                        el.parentElement.innerHTML = `<span class="text-2xl font-black text-gray-600">${ticker.charAt(0)}</span>`;
                      }
                    }}
                  />
                ) : (
                  <span className="text-2xl font-black text-gray-600">{ticker.charAt(0)}</span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{ticker}</h1>
                  <span className="text-gray-300 hidden sm:inline">│</span>
                  <span className="text-base font-medium text-gray-500">{market}</span>
                  {profile?.weburl && (
                    <a
                      href={profile.weburl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Company website"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-gray-500 text-base mt-0.5">{name}</p>
                {profile && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium border border-indigo-100">
                      {profile.finnhubIndustry || 'Stock'}
                    </span>
                    {profile.country && (
                      <span className="text-xs text-gray-400 font-medium">{profile.country}</span>
                    )}
                    {profile.currency && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{profile.currency}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Price + Actions */}
            <div className="flex flex-col items-start lg:items-end gap-3">
              <div>
                <div className="flex items-center gap-3 justify-start lg:justify-end">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums">
                    ${currentPrice.toFixed(2)}
                  </span>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    title="Refresh price"
                    className="p-2 rounded-xl bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all border border-gray-100"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className={`flex items-center gap-1.5 mt-1 ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="font-semibold tabular-nums">
                    {isUp ? '+' : ''}{priceChange.toFixed(2)}
                  </span>
                  <span className={`text-sm font-medium px-1.5 py-0.5 rounded-md ${isUp ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {isUp ? '+' : ''}{priceChangePercent.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Last updated{' '}
                  {new Date(lastUpdated).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddTradeOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Trade
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center border-b border-gray-200 bg-white rounded-t-2xl overflow-hidden shadow-sm border border-gray-100">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Main Grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-6">

          {/* ── Left Column ─────────────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-8 space-y-5">

            {/* ─── SUMMARY TAB ──────────────────────────────────────────── */}
            {activeTab === 'summary' && (
              <>
                {/* Price Chart */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Price History</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{name}</p>
                    </div>
                    {/* Time range selector */}
                    <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
                      {TIME_RANGES.map((r) => (
                        <button
                          key={r}
                          onClick={() => setTimeRange(r)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            timeRange === r
                              ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-[280px] relative">
                    {isChartLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl z-10">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af' }}
                          dy={6}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af' }}
                          domain={[chartMin, chartMax]}
                          tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                          width={55}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke={isUp ? '#10b981' : '#ef4444'}
                          strokeWidth={2}
                          fill="url(#grad)"
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                        {avgBuyPrice > 0 && avgBuyPrice >= chartMin && avgBuyPrice <= chartMax && (
                          <ReferenceLine
                            y={avgBuyPrice}
                            stroke="#6366f1"
                            strokeDasharray="5 3"
                            strokeWidth={1.5}
                            label={{
                              value: `Avg $${avgBuyPrice.toFixed(2)}`,
                              fill: '#6366f1',
                              fontSize: 11,
                              position: 'insideBottomRight',
                            }}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Summary stats: Total Return, Capital Gain, Dividends */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Summary</h3>
                  <p className="text-xs text-gray-400 mb-5">Since first purchase · Open positions only</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total return', value: totalReturn, pct: totalReturnPercent },
                      { label: 'Capital gain', value: totalReturn, pct: totalReturnPercent },
                      { label: 'Dividends', value: 0, pct: 0 },
                    ].map(({ label, value, pct }) => {
                      const isPos = value >= 0;
                      const isZero = value === 0;
                      return (
                        <div key={label} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                          <p className="text-xs text-gray-500 font-medium mb-2">{label}</p>
                          <p className={`text-xl font-bold tabular-nums ${
                            isZero ? 'text-gray-400' : isPos ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            {isZero ? '0.00%' : `${isPos ? '+' : ''}${pct.toFixed(2)}%`}
                          </p>
                          <p className={`text-sm font-medium mt-0.5 tabular-nums ${
                            isZero ? 'text-gray-400' : isPos ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            {isZero
                              ? 'US$0.00'
                              : `${isPos ? '+' : '-'}US$${Math.abs(value).toFixed(2)}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Key Statistics from Finnhub */}
                {metrics && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Key Statistics</h3>
                    <div className="grid grid-cols-2 gap-x-8">
                      {metrics.week52High > 0 && (
                        <StatRow label="52‑Week High" value={`$${metrics.week52High.toFixed(2)}`} highlight="green" />
                      )}
                      {metrics.week52Low > 0 && (
                        <StatRow label="52‑Week Low" value={`$${metrics.week52Low.toFixed(2)}`} highlight="red" />
                      )}
                      {metrics.peRatio > 0 && (
                        <StatRow label="P/E Ratio (TTM)" value={metrics.peRatio.toFixed(2)} />
                      )}
                      {metrics.eps !== 0 && (
                        <StatRow
                          label="EPS (TTM)"
                          value={`$${metrics.eps.toFixed(2)}`}
                          highlight={metrics.eps >= 0 ? undefined : 'red'}
                        />
                      )}
                      {metrics.beta !== 0 && (
                        <StatRow label="Beta" value={metrics.beta.toFixed(2)} />
                      )}
                      {metrics.dividendYield > 0 && (
                        <StatRow label="Dividend Yield" value={`${metrics.dividendYield.toFixed(2)}%`} />
                      )}
                      {profile?.marketCapitalization ? (
                        <StatRow
                          label="Market Cap"
                          value={formatLargeNumber(profile.marketCapitalization * 1e6)}
                        />
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Asset Classification */}
                {profile && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Asset Classification</h3>
                    <div className="grid grid-cols-2 gap-x-8">
                      <StatRow label="Investment type" value="Ordinary Shares (Stock)" />
                      <StatRow label="Country" value={profile.country || '—'} />
                      <StatRow label="Exchange" value={profile.exchange || market} />
                      <StatRow label="Currency" value={profile.currency || 'USD'} />
                      <StatRow label="Industry" value={profile.finnhubIndustry || '—'} />
                      {profile.ipo && (
                        <StatRow
                          label="IPO Date"
                          value={new Date(profile.ipo).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'long',
                          })}
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ─── TRADES TAB ───────────────────────────────────────────── */}
            {activeTab === 'trades' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Transaction History</h3>
                    <p className="text-xs text-gray-400 mt-0.5">All trades for {ticker}</p>
                  </div>
                  <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100">
                    {transactions.length} records
                  </span>
                </div>

                {transactions.length === 0 ? (
                  <div className="py-16 text-center">
                    <DollarSign className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No transactions found</p>
                    <button
                      onClick={() => setIsAddTradeOpen(true)}
                      className="mt-4 text-sm text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
                    >
                      Add your first trade →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50/80 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5 text-left">Date</th>
                            <th className="px-6 py-3.5 text-left">Type</th>
                            <th className="px-6 py-3.5 text-right">Quantity</th>
                            <th className="px-6 py-3.5 text-right">Price/Share</th>
                            <th className="px-6 py-3.5 text-right">Brokerage</th>
                            <th className="px-6 py-3.5 text-right">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {visibleTrades.map((tx) => {
                            const isBuy = tx.type === 'BUY';
                            const total = isBuy
                              ? tx.price * tx.quantity + tx.fee
                              : tx.price * tx.quantity - tx.fee;
                            return (
                              <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                                  {new Date(tx.date).toLocaleDateString('en-US', {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                  })}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${
                                    isBuy
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-rose-50 text-rose-600 border border-rose-100'
                                  }`}>
                                    {tx.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 tabular-nums">
                                  {tx.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                </td>
                                <td className="px-6 py-4 text-sm text-right text-gray-600 tabular-nums">
                                  ${tx.price.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-sm text-right text-gray-400 tabular-nums">
                                  {tx.fee > 0 ? `$${tx.fee.toFixed(2)}` : '—'}
                                </td>
                                <td className="px-6 py-4 text-sm text-right font-bold text-gray-900 tabular-nums">
                                  ${Math.abs(total).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {transactions.length > 8 && (
                      <div className="px-6 py-4 border-t border-gray-50 text-center bg-gray-50/50">
                        <button
                          onClick={() => setShowAllTrades(!showAllTrades)}
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          {showAllTrades
                            ? '↑ Show less'
                            : `↓ Show all ${transactions.length} transactions`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ─── NEWS TAB ──────────────────────────────────────────────── */}
            {activeTab === 'news' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900">Latest News</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Recent headlines for {ticker} · Powered by Finnhub</p>
                </div>
                {isNewsLoading ? (
                  <div className="py-20 flex items-center justify-center">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Loading news…</p>
                    </div>
                  </div>
                ) : news.length > 0 ? (
                  <div>
                    {news.map((article) => (
                      <NewsCard key={article.id} article={article} />
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <Newspaper className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No recent news found for {ticker}</p>
                    <p className="text-xs text-gray-400 mt-1">Try again later or check a financial news site</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right Sidebar ────────────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* Current Value */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
                Current value
              </p>
              <p className="text-3xl font-bold text-gray-900 tabular-nums mb-5">
                US${currentValue.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {/* Price × Qty = Total */}
              <div className="flex items-center justify-between text-sm bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-400 mb-1">Price</p>
                  <p className="font-semibold text-gray-800 tabular-nums">${currentPrice.toFixed(2)}</p>
                </div>
                <span className="text-gray-300 font-light text-lg mx-1">×</span>
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-400 mb-1">Qty</p>
                  <p className="font-semibold text-gray-800 tabular-nums">{totalQty}</p>
                </div>
                <span className="text-gray-300 font-light text-lg mx-1">=</span>
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-400 mb-1">Total</p>
                  <p className="font-semibold text-gray-800 tabular-nums">
                    ${currentValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Price Comparison */}
            {avgBuyPrice > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Price comparison</h3>
                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isProfit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {isProfit ? '▲' : '▼'}{' '}
                    {Math.abs(((currentPrice - avgBuyPrice) / avgBuyPrice) * 100).toFixed(1)}%
                  </div>
                </div>
                <PriceComparisonBar currentPrice={currentPrice} avgBuyPrice={avgBuyPrice} />
                <div className="mt-4 space-y-2 pt-3 border-t border-gray-50">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="text-gray-500">Current price</span>
                    </div>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      US${currentPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0" />
                      <span className="text-gray-500">Your avg buy price</span>
                    </div>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      US${avgBuyPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Your Investment */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Your investment</h3>
              <div className="space-y-0">
                <StatRow
                  label="Current value"
                  value={`US$${currentValue.toFixed(2)}`}
                />
                <StatRow label="Total quantity" value={String(totalQty)} />
                <StatRow
                  label="Cost base"
                  value={`US$${costBasis.toFixed(2)}`}
                />
                <StatRow
                  label="Cost base per share"
                  value={`US$${avgBuyPrice.toFixed(3)}`}
                />
                {totalFees > 0 && (
                  <StatRow
                    label="Total brokerage paid"
                    value={`US$${totalFees.toFixed(2)}`}
                  />
                )}
              </div>

              {/* Return badge */}
              <div className={`mt-4 p-3 rounded-xl flex items-center justify-between ${
                isProfit ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'
              }`}>
                <span className={`text-sm font-medium ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                  Total return
                </span>
                <div className="text-right">
                  <p className={`text-sm font-bold tabular-nums ${isProfit ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isProfit ? '+' : '-'}US${Math.abs(totalReturn).toFixed(2)}
                  </p>
                  <p className={`text-xs font-semibold ${isProfit ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {isProfit ? '+' : ''}{totalReturnPercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Market Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Market stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Day High</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {dayHigh > 0 ? `$${dayHigh.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Day Low</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {dayLow > 0 ? `$${dayLow.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Open</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {dayOpen > 0 ? `$${dayOpen.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Prev Close</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {prevClose > 0 ? `$${prevClose.toFixed(2)}` : '—'}
                  </p>
                </div>
                {metrics?.week52High ? (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">52W High</p>
                      <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                        ${metrics.week52High.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">52W Low</p>
                      <p className="text-sm font-semibold text-rose-500 tabular-nums">
                        ${metrics.week52Low.toFixed(2)}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>

              {/* 52-week range bar */}
              {metrics?.week52High && metrics.week52Low && currentPrice > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-xs text-gray-400 mb-2">52-week range</p>
                  <div className="relative h-2 bg-gray-100 rounded-full">
                    <div
                      className="absolute h-full bg-gradient-to-r from-rose-300 to-emerald-400 rounded-full"
                      style={{
                        left: '0%',
                        width: `${Math.min(
                          ((currentPrice - metrics.week52Low) / (metrics.week52High - metrics.week52Low)) * 100,
                          100
                        )}%`,
                      }}
                    />
                    <div
                      className="absolute w-3 h-3 bg-indigo-600 rounded-full -mt-0.5 border-2 border-white shadow-md"
                      style={{
                        left: `calc(${Math.min(
                          ((currentPrice - metrics.week52Low) / (metrics.week52High - metrics.week52Low)) * 100,
                          100
                        )}% - 6px)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                    <span>${metrics.week52Low.toFixed(0)}</span>
                    <span className="font-medium text-indigo-600">${currentPrice.toFixed(0)}</span>
                    <span>${metrics.week52High.toFixed(0)}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
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
