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
  if (converted === 0) return <span className="text-gray-400">{isCurrency ? symbol : ''}0.00{isPercentage ? '%' : ''}</span>;
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
}

interface DashboardClientProps {
  portfolioId: string;
  portfolioName: string;
  holdingsData: HoldingsGroup[];
  chartData: any[];
  summary: Summary;
  userDisplayName?: string;
}


export default function DashboardClient({ portfolioId, portfolioName, holdingsData, chartData, summary, userDisplayName = '' }: DashboardClientProps) {
  const router = useRouter();
  const { symbol, convert, fmt } = useCurrency();
  const { prefs, colors } = usePreferences();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userInitial] = useState<string>(userDisplayName[0]?.toUpperCase() || '');
  const [displayName] = useState<string>(userDisplayName);

  // 搜索栏状态
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const { searchStock } = useStock();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [returnDisplayMode, setReturnDisplayMode] = useState<'percentage' | 'currency'>('percentage');

  // 图表时间范围状态
  const [chartTimeRange, setChartTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'All'>('All');
  
  // Local state for unauthenticated users
  const [localHoldings, setLocalHoldings] = useState<HoldingsGroup[]>(holdingsData);
  const [localSummary, setLocalSummary] = useState<Summary>(summary);
  const [localChartData, setLocalChartData] = useState<any[]>(chartData);
  
  const [filteredChartData, setFilteredChartData] = useState(chartData);

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
          }));
        }
      } catch (err) {
        console.error("Failed to fetch live prices silently:", err);
      }
    };

    fetchLivePrices();
  }, []); // 仅在组件挂载后执行一次

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
          holdingsMap.set(ticker, { asset: t.asset, qty: 0, cost: 0, price: t.price, realizedGain: 0, lots: [] as { qty: number; unitCost: number }[] });
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
      for (const h of holdingsMap.values()) {
        totalRealizedGain += h.realizedGain;
      }

      setLocalSummary({
        totalValue,
        totalCapGain,
        totalCapGainPercentage: totalCost > 0 ? (totalCapGain / totalCost) * 100 : 0,
        totalRealizedGain,
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

  const isUp = localSummary.totalCapGain >= 0;
  const upColor = isUp ? colors.gain : colors.loss;
  const isUnrealizedUp = localSummary.totalCapGain >= 0;
  const unrealizedColor = isUnrealizedUp ? colors.gain : colors.loss;
  const safeRealizedGain = isNaN(localSummary.totalRealizedGain) ? 0 : localSummary.totalRealizedGain;
  const isRealizedUp = safeRealizedGain >= 0;
  const realizedColor = isRealizedUp ? colors.gain : colors.loss;
  const totalHoldingsCount = localHoldings.reduce((sum: number, g: HoldingsGroup) => sum + g.holdings.length, 0);

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">
      
      {/* 顶部导航栏 - 更舒适的高度和字体 */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight">
              <div className="bg-black text-white p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Folio</span>
            </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-400">
            <a href="/" className="text-black border-b-2 border-black py-[16px]">Investments</a>
            <a href="/transactions" className="hover:text-black transition-colors py-[16px]">Transactions</a>
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
              className="sm:hidden w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 active:bg-gray-200 transition-colors shadow-sm"
              title="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Mobile Transactions Link */}
            <Link 
              href="/transactions"
              className="md:hidden w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 active:bg-gray-200 transition-colors shadow-sm"
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
                  <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center font-bold text-[12px] group-hover:bg-gray-800 transition-colors shadow-sm shrink-0">
                    {userInitial}
                  </div>
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-black transition-colors hidden sm:block">
                    {displayName}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 text-gray-500 flex items-center justify-center group-hover:bg-gray-200 transition-colors shadow-sm shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-black transition-colors hidden sm:block">
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
          <div className="flex items-baseline space-x-3">
            <h1 className="text-[28px] font-bold text-black tracking-tight leading-none">{portfolioName}</h1>
            <span className="hidden sm:inline-block text-[13px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-md">Real-time</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 bg-white text-gray-400 rounded-lg border border-gray-200 hover:text-black hover:border-gray-300 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-1.5 bg-black text-white text-[13px] font-semibold rounded-lg hover:bg-gray-800 transition-all shadow-sm flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Trade</span>
            </button>
          </div>
        </div>

        {totalHoldingsCount === 0 ? (
          /* 空状态面板 */
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm relative w-full my-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Wallet className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-black tracking-tight mb-2">Build your portfolio</h2>
            <p className="text-sm text-gray-500 mb-8 max-w-[280px] text-center">
              Add your first trade to start tracking your market performance in real-time.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-8 py-3 bg-black text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-all shadow-sm flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add your first trade</span>
            </button>
            <p className="text-xs text-gray-400 mt-6 font-medium">No account required to start.</p>
          </div>
        ) : (
          <>
            {/* 顶部网格：核心指标 + 图表 - 两栏布局以提高密度 */}
            <div className="grid grid-cols-12 gap-5 mb-5">
          
          {/* 左侧：核心指标垂直排列 */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Portfolio Value</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-[28px] font-bold text-black tracking-tight tabular-nums">
                  {fmt(localSummary.totalValue)}
                </span>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${upColor.tailwind.bgLight} ${upColor.tailwind.text}`}>
                  {isUp ? '+' : ''}{localSummary.totalCapGainPercentage.toFixed(2)}%
                </span>
                <span className="text-[12px] font-medium text-gray-400 tabular-nums">
                  ({isUp ? '+' : '-'}{fmt(Math.abs(localSummary.totalCapGain))})
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Unrealized P&L</p>
                <div className="flex items-baseline">
                  <span className={`text-[20px] font-bold tracking-tight tabular-nums ${unrealizedColor.tailwind.text}`}>
                    {isUnrealizedUp ? '+' : '-'}{fmt(Math.abs(localSummary.totalCapGain))}
                  </span>
                </div>
                <p className="text-gray-400 text-[11px] font-medium mt-0.5">Open positions</p>
              </div>
              <div className="border-t border-gray-100" />
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Realized P&L</p>
                <div className="flex items-baseline">
                  <span className={`text-[20px] font-bold tracking-tight tabular-nums ${safeRealizedGain === 0 ? 'text-gray-400' : realizedColor.tailwind.text}`}>
                    {safeRealizedGain === 0 ? '' : (isRealizedUp ? '+' : '-')}{fmt(Math.abs(safeRealizedGain))}
                  </span>
                </div>
                <p className="text-gray-400 text-[11px] font-medium mt-0.5">Closed positions</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Assets</p>
                <p className="text-[22px] font-bold text-black tracking-tight">{totalHoldingsCount}</p>
              </div>
              <div className="flex -space-x-1.5">
                {localHoldings.flatMap(g => g.holdings).slice(0, 3).map((h) => (
                  <div key={h.ticker} className="w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-600 shadow-sm overflow-hidden z-10">
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
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
                <div>
                  <h2 className="text-[15px] font-bold text-black tracking-tight leading-none">Performance History</h2>
                  {(() => {
                    const first = filteredChartData.find(d => d.date !== 'Today');
                    if (!first || chartTimeRange === 'All') return <p className="text-[12px] text-gray-400 font-medium mt-1">Total portfolio value</p>;
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
                      ? <p className="text-[12px] text-gray-400 font-medium mt-1">
                          Showing data since {firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      : <p className="text-[12px] text-gray-400 font-medium mt-1">Total portfolio value</p>;
                  })()}
                </div>
                <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-100 w-full sm:w-auto overflow-x-auto no-scrollbar">
                  {(['1M', '3M', '6M', '1Y', 'All'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setChartTimeRange(range)}
                      className={`flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-[11px] font-bold rounded-md transition-all whitespace-nowrap ${
                        chartTimeRange === range
                          ? 'bg-white text-black shadow-sm'
                          : 'text-gray-400 hover:text-black'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredChartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000000" stopOpacity={0.08}/>
                        <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 500 }}
                      dy={8}
                      tickFormatter={(dateStr) => {
                        if (dateStr === 'Today') return 'Today';
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return '';
                        // Only show label on the 1st of each month
                        return d.getDate() === 1
                          ? d.toLocaleDateString('en-US', { month: 'short' })
                          : '';
                      }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 500 }} width={60} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px -5px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', padding: '10px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0' }}
                      labelStyle={{ marginBottom: '4px', color: '#888', fontSize: '10px', fontWeight: '600' }}
                      labelFormatter={(dateStr) => {
                        if (dateStr === 'Today') return 'Today';
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return dateStr;
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      }}
                      formatter={(value: any) => [`${fmt(Number(value))}`, undefined as any]}
                    />
                    {portfolioId === 'local-portfolio' ? (
                      <Area type="monotone" dataKey="Local" stroke="#000" strokeWidth={2} fill="#f3f4f6" fillOpacity={1} activeDot={{ r: 4, strokeWidth: 0, fill: '#000' }} />
                    ) : (
                      <Area type="monotone" dataKey="Total" stroke="#000000" strokeWidth={2} fill="url(#colorTotal)" activeDot={{ r: 4, strokeWidth: 0, fill: '#000' }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
            </div>
          </div>
        </div>

        {/* 持仓明细表 - 高密度列表设计 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-[15px] font-bold text-black tracking-tight">Investment Holdings</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setReturnDisplayMode('percentage')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${returnDisplayMode === 'percentage' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  %
                </button>
                <button
                  onClick={() => setReturnDisplayMode('currency')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${returnDisplayMode === 'currency' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  $
                </button>
              </div>
              <div className="text-[11px] text-gray-400 font-medium hidden sm:block">Sorted by Market</div>
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-4 sm:px-6 py-3">Asset</th>
                  <th className="px-4 sm:px-6 py-3 text-right hidden md:table-cell">Market Price</th>
                  <th className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">Position</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Value</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Return</th>
                  <th className="px-4 sm:px-6 py-3 text-right w-10 hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {localHoldings.map((group) => (
                  <React.Fragment key={group.market}>
                    {/* 分组标题行 */}
                    <tr className="bg-gray-50/30">
                      <td colSpan={6} className="px-4 sm:px-6 py-2 text-[10px] font-bold text-gray-400 bg-gray-50/20">
                        {group.market}
                      </td>
                    </tr>
                    {group.holdings.map((asset) => (
                      <tr 
                        key={asset.ticker} 
                        className="hover:bg-gray-50/80 transition-all cursor-pointer group" 
                        onClick={() => router.push(`/stock/${asset.ticker}`)}
                      >
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-[11px] text-gray-900 border border-gray-100 shadow-sm overflow-hidden shrink-0">
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
                              <div className="font-bold text-black text-[14px] leading-tight group-hover:underline underline-offset-2">{asset.ticker}</div>
                              <div className="text-[11px] text-gray-400 font-medium truncate max-w-[90px] sm:max-w-[200px]">{asset.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-[13px] font-semibold tabular-nums text-gray-900 hidden md:table-cell">{asset.price > 0 ? fmt(asset.price) : '--'}</td>
                        <td className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">
                          <div className="text-[13px] font-semibold text-gray-900 tabular-nums">{asset.qty.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-400 font-medium">Shares</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          <div className="text-[13px] font-bold text-black tabular-nums">{asset.price > 0 ? fmt(asset.value) : '--'}</div>
                          <div className="text-[10px] text-gray-400 font-medium sm:hidden">Value</div>
                          <div className="text-[10px] text-gray-400 font-medium hidden sm:block">Market Value</div>
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
                          /> : <span className="text-gray-400 text-[13px]">--</span>}
                          <div className="text-[10px] text-gray-400 font-medium hidden sm:block">Since purchase</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-black transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-black/[0.02] font-bold border-t border-gray-100">
                  <td className="px-4 sm:px-6 py-4 text-[13px] text-black">Total</td>
                  <td className="px-4 sm:px-6 py-4 hidden md:table-cell"></td>
                  <td className="px-4 sm:px-6 py-4 hidden sm:table-cell"></td>
                  <td className="px-4 sm:px-6 py-4 text-right text-[14px] sm:text-[15px] text-black tabular-nums">{fmt(localSummary.totalValue)}</td>
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
    </div>
  );
}