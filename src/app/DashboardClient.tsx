"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Search,
  ChevronDown,
  Plus,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  History as HistoryIcon,
  User
} from 'lucide-react';
import AddTransactionModal from './components/AddTransactionModal';
import GlobalSearch from './components/GlobalSearch';
import PortfolioSwitcher from './components/PortfolioSwitcher';
import DividendConfirmationModal from './components/DividendConfirmationModal';
import Link from 'next/link';
import { useCurrency } from '@/lib/useCurrency';
import { useStock } from '@/hooks/useStock';
import { usePreferences } from '@/lib/usePreferences';

// --- 辅助格式化组件 ---
interface FormatValueProps {
  val: number;
  isPercentage?: boolean;
  isCurrency?: boolean;
  symbol?: string;
  convert?: (n: number) => number;
  gainColor?: string;
  lossColor?: string;
}

const FormatValue: React.FC<FormatValueProps> = ({ val, isPercentage = false, isCurrency = true, symbol = '$', convert = (n) => n, gainColor = 'text-emerald-600', lossColor = 'text-rose-500' }) => {
  const converted = isCurrency ? convert(val) : val;
  if (converted === 0) return <span className="text-secondary">{isCurrency ? symbol : ''}0.00{isPercentage ? '%' : ''}</span>;
  const isPositive = converted > 0;
  const color = isPositive ? gainColor : lossColor;
  const prefix = isCurrency ? (converted < 0 ? `-${symbol}` : symbol) : '';
  const displayVal = Math.abs(converted).toFixed(2);

  return (
    <span className={`font-semibold ${color} tabular-nums flex items-center justify-end gap-0.5`}>
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {prefix}{displayVal}{isPercentage ? '%' : ''}
    </span>
  );
};

interface Asset {
  ticker: string;
  name: string;
  price: number;
  qty: number;
  value: number;
  capGain: number;
  return: number;
  market: string;
  logo?: string | null;
}
interface HoldingsGroup {
  market: string;
  holdings: Asset[];
}

interface Summary {
  totalValue: number;
  totalCapGain: number;
  totalCapGainPercentage: number;
  totalRealizedGain: number;
  totalDividendIncome: number;
}

interface DashboardClientProps {
  portfolioId: string;
  portfolioName: string;
  portfolios: { id: string; name: string }[];
  holdingsData: HoldingsGroup[];
  chartData: any[];
  summary: Summary;
  userDisplayName?: string;
}



// 根据数据 min/max 算出整齐的刻度值（如 0, 200, 400, 600）
function calcYTicks(data: any[], key: string, tickCount = 5): number[] {
  const values = data.map(d => d[key]).filter(v => typeof v === 'number' && isFinite(v));
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min];
  const range = max - min;
  const rawStep = range / (tickCount - 1);
  // 取整到好看的步长
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.ceil(rawStep / magnitude) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let i = 0; ticks.length < tickCount + 1; i++) {
    const v = start + i * step;
    ticks.push(v);
    if (v >= max) break;
  }
  return ticks;
}

const CustomXAxisTick = (props: any) => {
  const { x, y, payload, visibleTicksCount, index } = props;
  
  let dateText = payload.value;
  if (dateText === 'Today') {
    dateText = 'Today';
  } else if (dateText) {
    const d = new Date(dateText);
    if (!isNaN(d.getTime())) {
      dateText = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  }

  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
  if (index === 0) textAnchor = 'start';
  else if (index === visibleTicksCount - 1) textAnchor = 'end';

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={15} textAnchor={textAnchor} fill="var(--text-secondary)" fontSize={10} fontWeight={500}>
        {dateText}
      </text>
    </g>
  );
};

export default function DashboardClient({ portfolioId, portfolioName, portfolios, holdingsData, chartData, summary, userDisplayName = '' }: DashboardClientProps) {
  const router = useRouter();
  const { symbol, convert, fmt } = useCurrency();
  const { prefs, colors } = usePreferences();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
  const [pendingDividendCount, setPendingDividendCount] = useState(0);
  const [userInitial] = useState<string>(userDisplayName[0]?.toUpperCase() || '');
  const [displayName] = useState<string>(userDisplayName);

  // 搜索栏状态
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const { searchStock } = useStock();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [returnDisplayMode, setReturnDisplayMode] = useState<'percentage' | 'currency'>('percentage');

  // 图表时间范围状态
  const [chartTimeRange, setChartTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'All'>('All');
  const [chartMode, setChartMode] = useState<'value' | 'return'>('value');
  
  // Local state for unauthenticated users
  const [localHoldings, setLocalHoldings] = useState<HoldingsGroup[]>(holdingsData);
  const [localSummary, setLocalSummary] = useState<Summary>(summary);
  const [localChartData, setLocalChartData] = useState<any[]>(chartData);

  const [filteredChartData, setFilteredChartData] = useState(chartData);

  // 切换 portfolio 时显示骨架屏，同步 props → state
  const [isSwitching, setIsSwitching] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsSwitching(true);
    setLocalHoldings(holdingsData);
    setLocalSummary(summary);
    setLocalChartData(chartData);
    setFilteredChartData(chartData);
    // 给 React 一帧渲染骨架屏，再关闭
    const t = requestAnimationFrame(() => setIsSwitching(false));
    return () => cancelAnimationFrame(t);
  }, [portfolioId]);

  const yTicks = useMemo(() => {
    const key = chartMode === 'return' ? 'Return' : portfolioId === 'local-portfolio' ? 'Local' : 'Total';
    return calcYTicks(filteredChartData, key);
  }, [filteredChartData, chartMode, portfolioId]);

  const formatYTick = (value: number) => {
    if (chartMode === 'return') return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    return value >= 1000000 ? `${(value / 1000000).toFixed(1)}M`
         : value >= 1000 ? `${(value / 1000).toFixed(0)}k`
         : String(value);
  };

  // --- 客户端异步获取实时价格 ---
  useEffect(() => {
    // 收集所有需要获取价格的 ticker
    const tickers = new Set<string>();
    localHoldings.forEach(group => {
      group.holdings.forEach(h => tickers.add(h.ticker));
    });

    if (tickers.size === 0) return;

    const fetchLivePrices = async () => {
      try {
        const symbolParam = Array.from(tickers).join(',');
        const res = await fetch(`/api/stock/batch-quote?symbols=${symbolParam}`);
        
        if (res.headers.get('X-RateLimit-Exhausted') === 'true' || res.status === 429) {
          setIsRateLimited(true);
        }

        if (!res.ok) return;

        const livePrices: Record<string, number> = await res.json();
        
        if (Object.keys(livePrices).length > 0) {
          // 重新计算 holdings 和 summary
          let newTotalValue = 0;
          let newTotalCost = 0;

          const updatedHoldings = localHoldings.map(group => ({
            ...group,
            holdings: group.holdings.map(h => {
              const livePrice = livePrices[h.ticker];
              if (livePrice && livePrice > 0) {
                // 如果后端价格大于0说明有成本
                const costBasis = h.price > 0 && h.qty > 0 ? (h.value - h.capGain) : 0; 
                // 由于我们没有把原始 cost 直接传过来，只能反推： cost = value - capGain
                
                const newValue = livePrice * h.qty;
                const newCapGain = costBasis > 0 ? newValue - costBasis : newValue;
                const newReturnPct = costBasis > 0 ? (newCapGain / costBasis) * 100 : 0;
                
                newTotalValue += newValue;
                newTotalCost += costBasis;

                return { ...h, price: livePrice, value: newValue, capGain: newCapGain, return: newReturnPct };
              }
              // 如果没有获取到新价格，保持原样
              newTotalValue += h.value;
              // 反推成本
              newTotalCost += (h.value - h.capGain);
              return h;
            })
          }));

          setLocalHoldings(updatedHoldings);
          setLocalSummary(prev => ({
            totalValue: newTotalValue,
            totalCapGain: newTotalValue - newTotalCost,
            totalCapGainPercentage: newTotalCost > 0 ? ((newTotalValue - newTotalCost) / newTotalCost) * 100 : 0,
            totalRealizedGain: prev.totalRealizedGain,
            totalDividendIncome: prev.totalDividendIncome,
          }));
        }
      } catch (err) {
        console.error("Failed to fetch live prices silently:", err);
      }
    };

    fetchLivePrices();
  }, []); // 仅在组件挂载后执行一次

  // 获取待确认分红数量
  useEffect(() => {
    const fetchDividendStats = async () => {
      if (portfolioId === 'local-portfolio') return;

      try {
        const response = await fetch(`/api/transactions/dividends/stats?portfolioId=${portfolioId}`);
        if (response.ok) {
          const data = await response.json();
          setPendingDividendCount(data.pendingCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch dividend stats:', err);
      }
    };

    fetchDividendStats();
  }, [portfolioId]);

  // 初始化和监听本地数据
  useEffect(() => {
    // 非本地模式（已登录），无需加载 localStorage
    if (portfolioId !== 'local-portfolio') {
      return;
    }

    const loadLocalData = () => {
      const storedTransactions = localStorage.getItem('local_transactions');
      if (!storedTransactions) return;

      const txs = JSON.parse(storedTransactions);
      const method = prefs.costBasisMethod ?? 'FIFO';

      const holdingsMap = new Map<string, any>();
      let totalValue = 0;
      let totalCost = 0;

      for (const t of txs) {
        const ticker = t.asset.ticker;
        if (!holdingsMap.has(ticker)) {
          holdingsMap.set(ticker, { asset: t.asset, qty: 0, cost: 0, price: t.price, realizedGain: 0, dividendIncome: 0, lots: [] as { qty: number; unitCost: number }[] });
        }
        const current = holdingsMap.get(ticker);

        if (t.type === 'BUY') {
          const qty = Number(t.quantity);
          const unitCost = Number(t.price) + Number(t.fee) / qty;
          current.qty += qty;
          current.cost += qty * unitCost;
          if (method === 'FIFO') current.lots.push({ qty, unitCost });
        } else if (t.type === 'SELL') {
          const sellQty = Number(t.quantity);
          const sellPrice = Number(t.price);
          const sellFee = Number(t.fee);

          if (method === 'FIFO') {
            let remaining = sellQty;
            let costOfSold = 0;
            while (remaining > 0 && current.lots.length > 0) {
              const lot = current.lots[0];
              const consumed = Math.min(remaining, lot.qty);
              costOfSold += consumed * lot.unitCost;
              lot.qty -= consumed;
              remaining -= consumed;
              if (lot.qty <= 0) current.lots.shift();
            }
            current.realizedGain += (sellPrice * sellQty - sellFee) - costOfSold;
            current.qty -= sellQty;
            current.cost = current.lots.reduce((s: number, l: { qty: number; unitCost: number }) => s + l.qty * l.unitCost, 0);
          } else {
            const avgCost = current.qty > 0 ? current.cost / current.qty : 0;
            current.realizedGain += (sellPrice - avgCost) * sellQty - sellFee;
            current.qty -= sellQty;
            current.cost -= avgCost * sellQty;
          }

          if (current.qty <= 0) {
            current.qty = 0;
            current.cost = 0;
            current.lots = [];
          }
        } else if (t.type === 'DIVIDEND') {
          current.dividendIncome += Number(t.price) * Number(t.quantity);
        }
      }

      const calculatedHoldings = Array.from(holdingsMap.values())
        .filter(h => h.qty > 0)
        .map(h => {
          const value = h.qty * h.price; // 暂时用买入价替代现价
          totalValue += value;
          totalCost += h.cost;
          const capGain = value - h.cost;
          return {
            ticker: h.asset.ticker,
            name: h.asset.name,
            market: h.asset.market || 'Unknown',
            price: h.price,
            qty: h.qty,
            value: value,
            capGain: capGain,
            return: h.cost > 0 ? (capGain / h.cost) * 100 : 0,
            logo: null
          };
        });

      const totalCapGain = totalValue - totalCost;

      let totalRealizedGain = 0;
      let totalDividendIncome = 0;
      for (const h of holdingsMap.values()) {
        totalRealizedGain += h.realizedGain;
        totalDividendIncome += h.dividendIncome || 0;
      }

      setLocalSummary({
        totalValue,
        totalCapGain,
        totalCapGainPercentage: totalCost > 0 ? (totalCapGain / totalCost) * 100 : 0,
        totalRealizedGain,
        totalDividendIncome,
      });

      const markets = Array.from(new Set(calculatedHoldings.map(h => h.market)));
      setLocalHoldings(markets.map(m => ({
        market: m,
        holdings: calculatedHoldings.filter(h => h.market === m)
      })));

      // 本地简单模拟一下当天的图表点
      setLocalChartData([{ date: 'Today', Local: totalValue }]);
      setFilteredChartData([{ date: 'Today', Local: totalValue }]);
    };

    loadLocalData();

    // 监听 Modal 提交后的事件
    const handleLocalUpdate = () => loadLocalData();
    window.addEventListener('localTransactionsUpdated', handleLocalUpdate);
    return () => window.removeEventListener('localTransactionsUpdated', handleLocalUpdate);
  }, [portfolioId, prefs.costBasisMethod]);

  useEffect(() => {
    if (chartTimeRange === 'All') {
      setFilteredChartData(localChartData);
      return;
    }
    const now = new Date();
    const startDate = new Date();
    switch (chartTimeRange) {
      case '1M': startDate.setMonth(now.getMonth() - 1); break;
      case '3M': startDate.setMonth(now.getMonth() - 3); break;
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
    }
    const filtered = localChartData.filter(item => {
      if (item.date === 'Today') return true; // always include today
      return new Date(item.date) >= startDate;
    });
    setFilteredChartData(filtered);
  }, [chartTimeRange, localChartData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  const totalReturnAbs = localSummary.totalCapGain + (localSummary.totalDividendIncome || 0);
  const totalCostBase = localSummary.totalValue - localSummary.totalCapGain;
  const totalReturnPct = totalCostBase > 0 ? (totalReturnAbs / totalCostBase) * 100 : 0;

  const isUp = totalReturnAbs >= 0;
  const upColor = isUp ? colors.gain : colors.loss;
  const isUnrealizedUp = localSummary.totalCapGain >= 0;
  const unrealizedColor = isUnrealizedUp ? colors.gain : colors.loss;
  const safeRealizedGain = isNaN(localSummary.totalRealizedGain) ? 0 : localSummary.totalRealizedGain;
  const isRealizedUp = safeRealizedGain >= 0;
  const realizedColor = isRealizedUp ? colors.gain : colors.loss;
  const totalHoldingsCount = localHoldings.reduce((sum: number, g: HoldingsGroup) => sum + g.holdings.length, 0);

  if (isSwitching) {
    return (
      <div className="min-h-screen bg-page text-primary font-sans antialiased">
        <header className="bg-card/70 backdrop-blur-xl border-b border-border px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2 text-primary font-bold text-[17px] tracking-tight">
              <div className="bg-primary text-on-primary p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Folio</span>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 animate-pulse">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-48 bg-border rounded-xl"></div>
              <div className="hidden sm:inline-block h-5 w-16 bg-border rounded-md"></div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-border rounded-lg"></div>
              <div className="w-24 h-8 bg-border rounded-lg"></div>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-5 mb-5">
            <div className="col-span-12 lg:col-span-3 space-y-4">
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                <div className="h-3 w-24 bg-border rounded mb-3"></div>
                <div className="h-8 w-32 bg-border rounded mb-3"></div>
                <div className="flex space-x-2">
                  <div className="h-5 w-12 bg-border rounded"></div>
                  <div className="h-5 w-16 bg-border rounded"></div>
                </div>
              </div>
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i}>
                    {i > 1 && <div className="border-t border-border mb-4" />}
                    <div className="h-3 w-20 bg-border rounded mb-2"></div>
                    <div className="h-6 w-24 bg-border rounded mb-2"></div>
                    <div className="h-2 w-16 bg-border rounded"></div>
                  </div>
                ))}
              </div>
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex items-center justify-between">
                <div>
                  <div className="h-3 w-12 bg-border rounded mb-2"></div>
                  <div className="h-7 w-8 bg-border rounded"></div>
                </div>
                <div className="flex -space-x-1.5">
                  <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-10"></div>
                  <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-20"></div>
                  <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-30"></div>
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-9">
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm h-full flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <div className="h-4 w-32 bg-border rounded mb-2"></div>
                    <div className="h-3 w-40 bg-border rounded"></div>
                  </div>
                  <div className="flex bg-element rounded-lg p-0.5 border border-border w-full sm:w-auto h-8 space-x-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex-1 sm:w-10 h-full bg-border/50 rounded-md"></div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 bg-element-hover/30 rounded-xl w-full h-[300px]"></div>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="h-5 w-48 bg-border rounded"></div>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-element/50 border-b border-border">
                  <th className="px-6 py-3"><div className="h-3 w-12 bg-border rounded"></div></th>
                  <th className="px-6 py-3"><div className="h-3 w-20 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-3"><div className="h-3 w-16 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-3"><div className="h-3 w-12 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-3"><div className="h-3 w-20 bg-border rounded ml-auto"></div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {[1, 2, 3, 4, 5].map(row => (
                  <tr key={row}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-border"></div>
                        <div>
                          <div className="h-4 w-14 bg-border rounded mb-1"></div>
                          <div className="h-3 w-24 bg-border rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-border rounded ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 bg-border rounded ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-border rounded ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 bg-border rounded ml-auto"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-primary font-sans antialiased">
      <header className="bg-card/70 backdrop-blur-xl border-b border-border px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2 text-primary font-bold text-[17px] tracking-tight">
              <div className="bg-primary text-on-primary p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Folio</span>
            </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-secondary">
            <a href={`/${portfolioId !== 'local-portfolio' ? `?pid=${portfolioId}` : ''}`} className="text-primary border-b-2 border-primary py-[16px]">Investments</a>
            <a href={`/transactions${portfolioId !== 'local-portfolio' ? `?pid=${portfolioId}` : ''}`} className="hover:text-primary transition-colors py-[16px]">Transactions</a>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="hidden sm:block">
            <GlobalSearch />
          </div>
          <div className="flex items-center space-x-2.5">
            {/* Mobile Search Trigger */}
            <button 
              onClick={() => setShowMobileSearch(true)}
              className="sm:hidden w-7 h-7 rounded-full bg-element-hover border border-border flex items-center justify-center text-secondary active:bg-gray-200 transition-colors shadow-sm"
              title="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Mobile Transactions Link */}
            <Link
              href={`/transactions${portfolioId !== 'local-portfolio' ? `?pid=${portfolioId}` : ''}`}
              className="md:hidden w-7 h-7 rounded-full bg-element-hover border border-border flex items-center justify-center text-secondary active:bg-gray-200 transition-colors shadow-sm"
              title="Transactions"
            >
              <HistoryIcon className="w-3.5 h-3.5" />
            </Link>

            {/* Account Link - Direct navigation to settings */}
            <Link
              href="/settings"
              className="flex items-center space-x-2.5 group transition-all"
            >
              {userInitial ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-[12px] group-hover:bg-primary-hover transition-colors shadow-sm shrink-0">
                    {userInitial}
                  </div>
                  <span className="text-[13px] font-bold text-secondary group-hover:text-primary transition-colors hidden sm:block">
                    {displayName}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-full bg-element-hover border border-border text-secondary flex items-center justify-center group-hover:bg-gray-200 transition-colors shadow-sm shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[13px] font-bold text-secondary group-hover:text-primary transition-colors hidden sm:block">
                    Guest
                  </span>
                </>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <GlobalSearch isMobileOnly onClose={() => setShowMobileSearch(false)} />
      )}

        {/* 主内容区域 */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        
        {/* 标题 & 操作按钮 - 紧凑布局 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            {portfolios.length > 1 ? (
              <PortfolioSwitcher
                portfolios={portfolios}
                currentId={portfolioId}
                variant="title"
              />
            ) : (
              <h1 className="text-[28px] font-bold text-primary tracking-tight leading-none">
                {portfolioName || 'Portfolio'}
              </h1>
            )}
            <span className={`hidden sm:inline-block text-[13px] font-medium px-2 py-0.5 rounded-md transition-colors ${isRateLimited ? 'text-rose-500 bg-rose-50/50' : 'text-secondary bg-element-hover'}`}>
              {isRateLimited ? 'API Limit Reached' : 'Real-time'}
            </span>
            </div>          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 bg-card text-secondary rounded-lg border border-border hover:text-primary hover:border-border transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-1.5 bg-primary text-on-primary text-[13px] font-semibold rounded-lg hover:bg-primary-hover transition-all shadow-sm flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Trade</span>
            </button>
          </div>
        </div>

        {/* Pending Dividends Banner */}
        {pendingDividendCount > 0 && portfolioId !== 'local-portfolio' && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div 
              onClick={() => setIsDividendModalOpen(true)}
              className="group cursor-pointer bg-element hover:bg-element-hover border border-border rounded-2xl p-4 flex items-center justify-between transition-all active:scale-[0.99] shadow-sm"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300 ring-4 ring-black/5">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-primary tracking-tight">Pending Dividends</h3>
                  <p className="text-[12px] text-secondary font-medium">You have {pendingDividendCount} dividend payment{pendingDividendCount > 1 ? 's' : ''} to review and confirm.</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="hidden sm:flex px-2.5 py-1 bg-primary text-on-primary text-[11px] font-bold rounded-full uppercase tracking-wider">
                  Review Now
                </span>
                <ChevronRight className="w-5 h-5 text-secondary group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        )}

        {totalHoldingsCount === 0 ? (
          /* 空状态面板 */
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border shadow-sm relative w-full my-4">
            <div className="w-16 h-16 bg-element rounded-full flex items-center justify-center mb-6">
              <Wallet className="w-8 h-8 text-secondary" />
            </div>
            <h2 className="text-2xl font-bold text-primary tracking-tight mb-2">Build your portfolio</h2>
            <p className="text-sm text-secondary mb-8 max-w-[280px] text-center">
              Add your first trade to start tracking your market performance in real-time.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-8 py-3 bg-primary text-on-primary text-sm font-semibold rounded-full hover:bg-primary-hover transition-all shadow-sm flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add your first trade</span>
            </button>
            <p className="text-xs text-secondary mt-6 font-medium">{portfolioId === 'local-portfolio' ? 'No account required to start.' : 'Trades are synced to your account.'}</p>
          </div>
        ) : (
          <>
            {/* 顶部网格：核心指标 + 图表 - 两栏布局以提高密度 */}
            <div className="grid grid-cols-12 gap-5 mb-5">
          
          {/* 左侧：核心指标垂直排列 */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm relative overflow-hidden group">
              <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">Portfolio Value</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-[28px] font-bold text-primary tracking-tight tabular-nums">
                  {fmt(localSummary.totalValue)}
                </span>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${upColor.tailwind.bgLight} ${upColor.tailwind.text}`} title="Total Return (Including Dividends)">
                  {isUp ? '+' : ''}{totalReturnPct.toFixed(2)}%
                </span>
                <span className="text-[12px] font-medium text-secondary tabular-nums">
                  ({isUp ? '+' : '-'}{fmt(Math.abs(totalReturnAbs))})
                </span>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
              <div>
                <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">Unrealized P&L</p>
                <div className="flex items-baseline">
                  <span className={`text-[20px] font-bold tracking-tight tabular-nums ${unrealizedColor.tailwind.text}`}>
                    {isUnrealizedUp ? '+' : '-'}{fmt(Math.abs(localSummary.totalCapGain))}
                  </span>
                </div>
                <p className="text-secondary text-[11px] font-medium mt-0.5">Open positions</p>
              </div>
              <div className="border-t border-border" />
              <div>
                <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">Realized P&L</p>
                <div className="flex items-baseline">
                  <span className={`text-[20px] font-bold tracking-tight tabular-nums ${safeRealizedGain === 0 ? 'text-secondary' : realizedColor.tailwind.text}`}>
                    {safeRealizedGain === 0 ? '' : (isRealizedUp ? '+' : '-')}{fmt(Math.abs(safeRealizedGain))}
                  </span>
                </div>
                <p className="text-secondary text-[11px] font-medium mt-0.5">Closed positions</p>
              </div>
              <div className="border-t border-border" />
              <div>
                <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">Dividends Collected</p>
                <div className="flex items-baseline justify-between">
                  <span className={`text-[20px] font-bold tracking-tight tabular-nums ${localSummary.totalDividendIncome > 0 ? colors.gain.tailwind.text : 'text-secondary'}`}>
                    {localSummary.totalDividendIncome > 0 ? '+' : ''}{fmt(localSummary.totalDividendIncome || 0)}
                  </span>
                </div>
                <p className="text-secondary text-[11px] font-medium mt-0.5">Cash reinvested or withdrawn</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">Assets</p>
                <p className="text-[22px] font-bold text-primary tracking-tight">{totalHoldingsCount}</p>
              </div>
              <div className="flex -space-x-1.5">
                {localHoldings.flatMap(g => g.holdings).slice(0, 3).map((h) => (
                  <div key={h.ticker} className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-[9px] font-bold text-secondary shadow-sm overflow-hidden z-10">
                    {h.logo ? (
                      <Image 
                        src={h.logo} 
                        alt={h.ticker} 
                        width={28} 
                        height={28} 
                        className="w-full h-full object-cover"
                        unoptimized={true}
                      />
                    ) : (
                      h.ticker.charAt(0)
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：图表占据大块空间 */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm h-full flex flex-col">
              <div className="flex flex-col gap-3 mb-6">
                {/* 桌面端：一行；手机端：两行 */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
                  <div>
                    <h2 className="text-[15px] font-bold text-primary tracking-tight leading-none">Performance History</h2>
                    {(() => {
                      if (chartMode === 'return') {
                        const todayPoint = filteredChartData[filteredChartData.length - 1];
                        const returnVal = todayPoint?.Return ?? 0;
                        const isPos = returnVal >= 0;
                        return (
                          <p className={`text-[12px] font-medium mt-1 ${isPos ? colors.gain.tailwind.text : colors.loss.tailwind.text}`}>
                            {isPos ? '+' : ''}{returnVal.toFixed(2)}% total return
                          </p>
                        );
                      }
                      const first = filteredChartData.find(d => d.date !== 'Today');
                      if (!first || chartTimeRange === 'All') return <p className="text-[12px] text-secondary font-medium mt-1">Total portfolio value</p>;
                      const now = new Date();
                      const cutoff = new Date();
                      switch (chartTimeRange) {
                        case '1M': cutoff.setMonth(now.getMonth() - 1); break;
                        case '3M': cutoff.setMonth(now.getMonth() - 3); break;
                        case '6M': cutoff.setMonth(now.getMonth() - 6); break;
                        case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break;
                      }
                      const firstDate = new Date(first.date);
                      const isConstrained = firstDate > cutoff;
                      return isConstrained
                        ? <p className="text-[12px] text-secondary font-medium mt-1">
                            Showing data since {firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        : <p className="text-[12px] text-secondary font-medium mt-1">Total portfolio value</p>;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    {portfolioId !== 'local-portfolio' && (
                      <div className="flex bg-element rounded-lg p-0.5 border border-border">
                        {(['value', 'return'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setChartMode(mode)}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all whitespace-nowrap ${
                              chartMode === mode ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:text-primary'
                            }`}
                          >
                            {mode === 'value' ? 'Value' : 'Return %'}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex bg-element rounded-lg p-0.5 border border-border overflow-x-auto no-scrollbar">
                      {(['1M', '3M', '6M', '1Y', 'All'] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setChartTimeRange(range)}
                          className={`px-3 py-1.5 sm:py-1 text-[11px] font-bold rounded-md transition-all whitespace-nowrap text-center ${
                            chartTimeRange === range
                              ? 'bg-card text-primary shadow-sm'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[300px] w-full relative">
                {/* 自定义 Y 轴数字，绝对定位贴右边框 */}
                <div className="absolute right-0 top-[10px] bottom-[20px] flex flex-col-reverse justify-between items-end pointer-events-none z-10">
                  {yTicks.map((v, i) => (
                    <span key={i} className="text-[10px] font-medium text-secondary leading-none">
                      {formatYTick(v)}
                    </span>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    const firstPoint = filteredChartData.find(d => d.date !== 'Today');
                    const lastPoint = filteredChartData[filteredChartData.length - 1];
                    let isGain = true;
                    if (firstPoint && lastPoint) {
                      if (chartMode === 'return') {
                        isGain = (lastPoint.Return ?? 0) >= 0;
                      } else {
                        const key = portfolioId === 'local-portfolio' ? 'Local' : 'Total';
                        isGain = (lastPoint[key] ?? 0) >= (firstPoint[key] ?? 0);
                      }
                    }
                    const chartColorHex = isGain ? colors.gain.hex : colors.loss.hex;

                    return (
                      <AreaChart data={filteredChartData} margin={{ top: 10, right: 52, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartColorHex} stopOpacity={0.08}/>
                            <stop offset="95%" stopColor={chartColorHex} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={<CustomXAxisTick />}
                          interval="equidistantPreserveStart"
                          minTickGap={20}
                        />
                        <YAxis hide domain={[yTicks[0] ?? 'auto', yTicks[yTicks.length - 1] ?? 'auto']} ticks={yTicks} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 20px -5px rgb(0 0 0 / 0.2)', backgroundColor: 'var(--bg-card)', backdropFilter: 'blur(8px)', padding: '10px' }}
                          itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0', color: 'var(--text-primary)' }}
                          labelStyle={{ marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '600' }}
                          labelFormatter={(dateStr) => {
                            if (dateStr === 'Today') return 'Today';
                            const d = new Date(dateStr);
                            if (isNaN(d.getTime())) return dateStr;
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          }}
                          formatter={(value: any) =>
                            chartMode === 'return'
                              ? [`${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`, undefined as any]
                              : [`${fmt(Number(value))}`, undefined as any]
                          }
                        />
                        {portfolioId === 'local-portfolio' ? (
                          <Area type="monotone" dataKey="Local" stroke={chartColorHex} strokeWidth={2} fill="var(--bg-element)" fillOpacity={1} activeDot={{ r: 4, strokeWidth: 0, fill: chartColorHex }} />
                        ) : (
                          <Area type="monotone" dataKey={chartMode === 'return' ? 'Return' : 'Total'} stroke={chartColorHex} strokeWidth={2} fill="url(#colorTotal)" activeDot={{ r: 4, strokeWidth: 0, fill: chartColorHex }} />
                        )}
                      </AreaChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>
              
            </div>
          </div>
        </div>

        {/* 持仓明细表 - 高密度列表设计 */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="text-[15px] font-bold text-primary tracking-tight">Investment Holdings</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-element-hover rounded-lg p-0.5">
                <button
                  onClick={() => setReturnDisplayMode('percentage')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${returnDisplayMode === 'percentage' ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:text-gray-700'}`}
                >
                  %
                </button>
                <button
                  onClick={() => setReturnDisplayMode('currency')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${returnDisplayMode === 'currency' ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:text-gray-700'}`}
                >
                  $
                </button>
              </div>
              <div className="text-[11px] text-secondary font-medium hidden sm:block">Sorted by Market</div>
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-element/50 text-[10px] font-bold text-secondary uppercase tracking-widest border-b border-border">
                  <th className="px-4 sm:px-6 py-3">Asset</th>
                  <th className="px-4 sm:px-6 py-3 text-right hidden md:table-cell">Market Price</th>
                  <th className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">Position</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Value</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Return</th>
                  <th className="px-4 sm:px-6 py-3 text-right w-10 hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {localHoldings.map((group) => (
                  <React.Fragment key={group.market}>
                    {/* 分组标题行 */}
                    <tr className="bg-element/30">
                      <td colSpan={6} className="px-4 sm:px-6 py-2 text-[10px] font-bold text-secondary bg-element/20">
                        {group.market}
                      </td>
                    </tr>
                    {group.holdings.map((asset) => (
                      <tr 
                        key={asset.ticker} 
                        className="hover:bg-element/80 transition-all cursor-pointer group" 
                        onClick={() => router.push(`/stock/${asset.ticker}`)}
                      >
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center font-bold text-[11px] text-primary border border-border shadow-sm overflow-hidden shrink-0">
                              {asset.logo ? (
                                <Image 
                                  src={asset.logo} 
                                  alt={asset.ticker} 
                                  width={32} 
                                  height={32} 
                                  className="w-full h-full object-cover"
                                  unoptimized={true} // Bypasses Next.js image optimization which fails on some local proxy setups
                                />
                              ) : (
                                asset.ticker.charAt(0)
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-primary text-[14px] leading-tight group-hover:underline underline-offset-2">{asset.ticker}</div>
                              <div className="text-[11px] text-secondary font-medium truncate max-w-[90px] sm:max-w-[200px]">{asset.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-[13px] font-semibold tabular-nums text-primary hidden md:table-cell">{asset.price > 0 ? fmt(asset.price) : '--'}</td>
                        <td className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">
                          <div className="text-[13px] font-semibold text-primary tabular-nums">{asset.qty.toLocaleString()}</div>
                          <div className="text-[10px] text-secondary font-medium">Shares</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          <div className="text-[13px] font-bold text-primary tabular-nums">{asset.price > 0 ? fmt(asset.value) : '--'}</div>
                          <div className="text-[10px] text-secondary font-medium sm:hidden">Value</div>
                          <div className="text-[10px] text-secondary font-medium hidden sm:block">Market Value</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          {asset.price > 0 ? <FormatValue
                            val={returnDisplayMode === 'percentage' ? asset.return : asset.capGain}
                            isPercentage={returnDisplayMode === 'percentage'}
                            isCurrency={returnDisplayMode === 'currency'}
                            symbol={symbol}
                            convert={convert}
                            gainColor={colors.gain.tailwind.text}
                            lossColor={colors.loss.tailwind.text}
                          /> : <span className="text-secondary text-[13px]">--</span>}
                          <div className="text-[10px] text-secondary font-medium hidden sm:block">Since purchase</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">
                          <ChevronRight className="w-4 h-4 text-secondary group-hover:text-primary transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-primary/[0.02] font-bold border-t border-border">
                  <td className="px-4 sm:px-6 py-4 text-[13px] text-primary">Total</td>
                  <td className="px-4 sm:px-6 py-4 hidden md:table-cell"></td>
                  <td className="px-4 sm:px-6 py-4 hidden sm:table-cell"></td>
                  <td className="px-4 sm:px-6 py-4 text-right text-[14px] sm:text-[15px] text-primary tabular-nums">{fmt(localSummary.totalValue)}</td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <FormatValue
                      val={returnDisplayMode === 'percentage' ? localSummary.totalCapGainPercentage : localSummary.totalCapGain}
                      isPercentage={returnDisplayMode === 'percentage'}
                      isCurrency={returnDisplayMode === 'currency'}
                      symbol={symbol}
                      convert={convert}
                      gainColor={colors.gain.tailwind.text}
                      lossColor={colors.loss.tailwind.text}
                    />
                  </td>
                  <td className="px-4 sm:px-6 py-4 hidden sm:table-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </>
        )}
      </main>

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        portfolioName={portfolioName}
        portfolioId={portfolioId}
      />

      <DividendConfirmationModal
        isOpen={isDividendModalOpen}
        onClose={() => setIsDividendModalOpen(false)}
        portfolioId={portfolioId}
        onConfirmed={() => {
          // Refresh the page to show updated dividend income
          setPendingDividendCount(0);
          window.location.reload();
        }}
      />
    </div>
  );
}
