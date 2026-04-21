"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Search,
  Plus,
  TrendingUp,
  DollarSign,
  RefreshCw,
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  History as HistoryIcon,
  User,
  Bell
} from 'lucide-react';
import AddTransactionModal from './components/AddTransactionModal';
import GlobalSearch from './components/GlobalSearch';
import PortfolioSwitcher from './components/PortfolioSwitcher';
import DividendConfirmationModal from './components/DividendConfirmationModal';
import CachedAssetLogo from './components/CachedAssetLogo';
import DashboardSkeleton from './components/DashboardSkeleton';
import Link from 'next/link';
import { useCurrency } from '@/lib/useCurrency';
import { usePreferences } from '@/lib/usePreferences';
import type { PortfolioClientRecord } from '@/lib/portfolio-client';

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
  initialPortfolios?: PortfolioClientRecord[];
  holdingsData: HoldingsGroup[];
  chartData: ChartPoint[];
  summary: Summary;
  initialPendingDividendCount?: number;
  userDisplayName?: string;
}

interface ChartPoint {
  date: string;
  Total?: number;
  Local?: number;
  Return?: number;
  SPY?: number | null;
  QQQ?: number | null;
}

interface XAxisTickProps {
  x?: number;
  y?: number;
  payload?: {
    value?: string;
  };
  visibleTicksCount?: number;
  index?: number;
  locale?: string;
  todayLabel?: string;
}

type LocalTransaction = {
  type: string;
  quantity: number;
  price: number;
  fee: number;
  asset: {
    ticker: string;
    name: string;
    market?: string | null;
  };
}

type LocalHoldingLot = {
  qty: number;
  unitCost: number;
}

type LocalHoldingAccumulator = {
  asset: LocalTransaction["asset"];
  qty: number;
  cost: number;
  price: number;
  realizedGain: number;
  dividendIncome: number;
  lots: LocalHoldingLot[];
}



// 根据数据 min/max 算出整齐的刻度值（如 0, 200, 400, 600）
function calcYTicks(data: ChartPoint[], key: keyof ChartPoint, tickCount = 5): number[] {
  const values = data
    .map(d => d[key])
    .filter((v): v is number => typeof v === 'number' && isFinite(v));
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

function calcYTicksForKeys(data: ChartPoint[], keys: (keyof ChartPoint)[], tickCount = 5): number[] {
  const values = data.flatMap((point) =>
    keys
      .map((key) => point[key])
      .filter((value): value is number => typeof value === 'number' && isFinite(value))
  );

  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min];

  const range = max - min;
  const rawStep = range / (tickCount - 1);
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

const CustomXAxisTick = (props: XAxisTickProps) => {
  const { x, y, payload, visibleTicksCount = 0, index, locale = 'en', todayLabel = 'Today' } = props;
  
  let dateText = payload?.value;
  if (dateText === 'Today') {
    dateText = todayLabel;
  } else if (dateText) {
    const d = new Date(dateText);
    if (!isNaN(d.getTime())) {
      dateText = d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
    }
  }

  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
  if (index === 0) textAnchor = 'start';
  else if (index === visibleTicksCount - 1) textAnchor = 'end';

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text x={0} y={0} dy={15} textAnchor={textAnchor} fill="var(--text-secondary)" fontSize={10} fontWeight={500}>
        {dateText}
      </text>
    </g>
  );
};

export default function DashboardClient({
  portfolioId,
  portfolioName,
  portfolios,
  initialPortfolios,
  holdingsData,
  chartData,
  summary,
  initialPendingDividendCount = 0,
  userDisplayName = '',
}: DashboardClientProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { symbol, convert, fmt } = useCurrency();
  const { prefs, colors } = usePreferences({
    initialPortfolios,
    cloudSync: portfolioId !== 'local-portfolio',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
  const [pendingDividendCountOverride, setPendingDividendCountOverride] = useState<{
    portfolioId: string;
    count: number;
  } | null>(null);
  const [userInitial] = useState<string>(userDisplayName[0]?.toUpperCase() || '');
  const [displayName] = useState<string>(userDisplayName);

  // 搜索栏状态
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [returnDisplayMode, setReturnDisplayMode] = useState<'percentage' | 'currency'>('percentage');

  // 图表时间范围状态
  const [chartTimeRange, setChartTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'All'>('All');
  const [chartMode, setChartMode] = useState<'value' | 'return'>('value');
  const [benchmark, setBenchmark] = useState<'SPY' | 'QQQ' | null>(null);
  
  // Local state for unauthenticated users
  const [localHoldings, setLocalHoldings] = useState<HoldingsGroup[]>(holdingsData);
  const [localSummary, setLocalSummary] = useState<Summary>(summary);
  const [localChartData, setLocalChartData] = useState<ChartPoint[]>(chartData);

  // 切换 portfolio 时显示骨架屏，同步 props → state
  const [isSwitching, setIsSwitching] = useState(false);
  const isFirstRender = useRef(true);
  const fetchedPricesForPortfolioRef = useRef<string | null>(null);
  const refreshedProfileLogosForPortfolioRef = useRef<string | null>(null);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    let closeFrame = 0;
    const openFrame = requestAnimationFrame(() => {
      setIsSwitching(true);
      setLocalHoldings(holdingsData);
      setLocalSummary(summary);
      setLocalChartData(chartData);
      // 给 React 一帧渲染骨架屏，再关闭
      closeFrame = requestAnimationFrame(() => setIsSwitching(false));
    });
    return () => {
      cancelAnimationFrame(openFrame);
      cancelAnimationFrame(closeFrame);
    };
  }, [chartData, holdingsData, portfolioId, summary]);

  useEffect(() => {
    if (!portfolioId || portfolioId === 'local-portfolio') return;
    if (refreshedProfileLogosForPortfolioRef.current === portfolioId) return;

    const tickers = [
      ...new Set(
        localHoldings.flatMap((group) => group.holdings.map((holding) => holding.ticker)).filter(Boolean)
      ),
    ];

    if (tickers.length === 0) return;

    refreshedProfileLogosForPortfolioRef.current = portfolioId;
    let cancelled = false;

    const refreshVisibleAssetProfiles = async () => {
      const results = await Promise.allSettled(
        tickers.map((ticker) => fetch(`/api/assets/${encodeURIComponent(ticker)}/sync?force=profile`, {
          method: 'POST',
        }))
      );

      if (cancelled) return;

      const hasSuccessfulRefresh = results.some(
        (result) => result.status === 'fulfilled' && result.value.ok
      );

      if (hasSuccessfulRefresh) {
        router.refresh();
      }
    };

    void refreshVisibleAssetProfiles();

    return () => {
      cancelled = true;
    };
  }, [localHoldings, portfolioId, router]);

  const formatYTick = (value: number) => {
    if (chartMode === 'return') return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    return value >= 1000000 ? `${(value / 1000000).toFixed(1)}M`
         : value >= 1000 ? `${(value / 1000).toFixed(0)}k`
         : String(value);
  };

  // --- 客户端异步获取实时价格 ---
  useEffect(() => {
    if (fetchedPricesForPortfolioRef.current === portfolioId) return;
    fetchedPricesForPortfolioRef.current = portfolioId;

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

    const timer = window.setTimeout(() => {
      void fetchLivePrices();
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [localHoldings, portfolioId]);

  // 获取待确认分红数量
  const pendingDividendCount = pendingDividendCountOverride?.portfolioId === portfolioId
    ? pendingDividendCountOverride.count
    : initialPendingDividendCount;

  useEffect(() => {
    let cancelled = false;

    const syncAndRefreshDividendStats = async () => {
      if (portfolioId === 'local-portfolio') return;

      // 客户端节流：与服务端 6 小时节流保持一致，避免每次加载都发请求
      const THROTTLE_MS = 6 * 60 * 60 * 1000;
      const storageKey = `dividend_sync_at_${portfolioId}`;
      const lastSyncAt = Number(localStorage.getItem(storageKey) || 0);
      const shouldSync = Date.now() - lastSyncAt >= THROTTLE_MS;

      if (!shouldSync) return;

      try {
        await fetch('/api/transactions/dividends/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portfolioId }),
        });
        localStorage.setItem(storageKey, String(Date.now()));
      } catch (err) {
        console.error('Failed to sync dividends automatically:', err);
        return;
      }

      try {
        const response = await fetch(`/api/transactions/dividends/stats?portfolioId=${portfolioId}`);
        if (!cancelled && response.ok) {
          const data = await response.json();
          setPendingDividendCountOverride({
            portfolioId,
            count: data.pendingCount || 0,
          });
        }
      } catch (err) {
        console.error('Failed to fetch dividend stats:', err);
      }
    };

    const timer = window.setTimeout(() => {
      void syncAndRefreshDividendStats();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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

      const txs = JSON.parse(storedTransactions) as LocalTransaction[];
      const method = prefs.costBasisMethod ?? 'FIFO';

      const holdingsMap = new Map<string, LocalHoldingAccumulator>();
      let totalValue = 0;
      let totalCost = 0;

      for (const t of txs) {
        const ticker = t.asset.ticker;
        if (!holdingsMap.has(ticker)) {
          holdingsMap.set(ticker, { asset: t.asset, qty: 0, cost: 0, price: t.price, realizedGain: 0, dividendIncome: 0, lots: [] });
        }
        const current = holdingsMap.get(ticker);
        if (!current) continue;

        if (t.type === 'BUY') {
          const qty = Number(t.quantity);
          if (qty <= 0) continue;
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
    };

    loadLocalData();

    // 监听 Modal 提交后的事件
    const handleLocalUpdate = () => loadLocalData();
    window.addEventListener('localTransactionsUpdated', handleLocalUpdate);
    return () => window.removeEventListener('localTransactionsUpdated', handleLocalUpdate);
  }, [portfolioId, prefs.costBasisMethod]);

  const filteredChartData = useMemo<ChartPoint[]>(() => {
    if (chartTimeRange === 'All') {
      return localChartData;
    }

    const now = new Date();
    const startDate = new Date();
    switch (chartTimeRange) {
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return localChartData.filter((item) => {
      if (item.date === 'Today') return true;
      return new Date(item.date) >= startDate;
    });
  }, [chartTimeRange, localChartData]);

  const chartDisplayData = useMemo<ChartPoint[]>(() => {
    if (chartMode !== 'return' || chartTimeRange === 'All') {
      return filteredChartData;
    }

    const baselinePoint = filteredChartData.find((point: ChartPoint) => point.date !== 'Today') ?? filteredChartData[0];
    const baselineFactor = 1 + ((baselinePoint?.Return ?? 0) / 100);
    const benchmarkBaselineFactors = {
      SPY: baselinePoint?.SPY != null ? 1 + (baselinePoint.SPY / 100) : null,
      QQQ: baselinePoint?.QQQ != null ? 1 + (baselinePoint.QQQ / 100) : null,
    };

    return filteredChartData.map((point: ChartPoint) => {
      const currentFactor = 1 + ((point.Return ?? 0) / 100);
      const rebasedReturn = baselineFactor > 0 && currentFactor > 0
        ? ((currentFactor / baselineFactor) - 1) * 100
        : (point.Return ?? 0) - (baselinePoint?.Return ?? 0);

      const rebasedSPY = point.SPY != null && benchmarkBaselineFactors.SPY != null && benchmarkBaselineFactors.SPY > 0
        ? ((1 + point.SPY / 100) / benchmarkBaselineFactors.SPY - 1) * 100
        : point.SPY;
      const rebasedQQQ = point.QQQ != null && benchmarkBaselineFactors.QQQ != null && benchmarkBaselineFactors.QQQ > 0
        ? ((1 + point.QQQ / 100) / benchmarkBaselineFactors.QQQ - 1) * 100
        : point.QQQ;

      return {
        ...point,
        Return: Math.round(rebasedReturn * 100) / 100,
        SPY: rebasedSPY != null ? Math.round(rebasedSPY * 100) / 100 : null,
        QQQ: rebasedQQQ != null ? Math.round(rebasedQQQ * 100) / 100 : null,
      };
    });
  }, [chartMode, chartTimeRange, filteredChartData]);

  const chartRangeMeta = useMemo(() => {
    const firstPoint = filteredChartData.find((point: ChartPoint) => point.date !== 'Today');

    if (!firstPoint || chartTimeRange === 'All') {
      return {
        firstDate: firstPoint ? new Date(firstPoint.date) : null,
        isConstrained: false,
      };
    }

    const cutoff = new Date();
    switch (chartTimeRange) {
      case '1M':
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
      case '3M':
        cutoff.setMonth(cutoff.getMonth() - 3);
        break;
      case '6M':
        cutoff.setMonth(cutoff.getMonth() - 6);
        break;
      case '1Y':
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        break;
    }

    const firstDate = new Date(firstPoint.date);

    return {
      firstDate,
      isConstrained: firstDate > cutoff,
    };
  }, [chartTimeRange, filteredChartData]);

  const chartSubtitle = useMemo(() => {
    if (chartMode === 'return') {
      const lastPoint = chartDisplayData[chartDisplayData.length - 1];
      const returnVal = lastPoint?.Return ?? 0;
      const isPositive = returnVal >= 0;

      if (chartTimeRange === 'All') {
        return {
          className: isPositive ? colors.gain.tailwind.text : colors.loss.tailwind.text,
          text: `${isPositive ? '+' : ''}${returnVal.toFixed(2)}% ${t('chart.totalReturnSuffix')}`,
        };
      }

      if (chartRangeMeta.firstDate && chartRangeMeta.isConstrained) {
        return {
          className: isPositive ? colors.gain.tailwind.text : colors.loss.tailwind.text,
          text: `${isPositive ? '+' : ''}${returnVal.toFixed(2)}% ${t('chart.returnSince', {
            date: chartRangeMeta.firstDate.toLocaleDateString(locale, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          })}`,
        };
      }

      return {
        className: isPositive ? colors.gain.tailwind.text : colors.loss.tailwind.text,
        text: `${isPositive ? '+' : ''}${returnVal.toFixed(2)}% ${t('chart.returnOver', {
          range: chartTimeRange,
        })}`,
      };
    }

    if (!chartRangeMeta.firstDate || chartTimeRange === 'All') {
      return {
        className: 'text-secondary',
        text: t('chart.totalPortfolioValue'),
      };
    }

    if (chartRangeMeta.isConstrained) {
      return {
        className: 'text-secondary',
        text: t('chart.showingSince', {
          date: chartRangeMeta.firstDate.toLocaleDateString(locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        }),
      };
    }

    return {
      className: 'text-secondary',
      text: t('chart.totalPortfolioValue'),
    };
  }, [chartDisplayData, chartMode, chartRangeMeta, chartTimeRange, colors.gain.tailwind.text, colors.loss.tailwind.text, locale, t]);

  const yTicks = useMemo(() => {
    if (chartMode === 'return') {
      const keys: (keyof ChartPoint)[] = ['Return'];
      if (benchmark) keys.push(benchmark);
      return calcYTicksForKeys(chartDisplayData, keys);
    }

    const key = portfolioId === 'local-portfolio' ? 'Local' : 'Total';
    return calcYTicks(chartDisplayData, key);
  }, [benchmark, chartDisplayData, chartMode, portfolioId]);

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
    return <DashboardSkeleton />;
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
            <a href={`/app${portfolioId !== 'local-portfolio' ? `?pid=${portfolioId}` : ''}`} className="text-primary border-b-2 border-primary py-[16px]">{t('nav.investments')}</a>
            <a href={`/transactions${portfolioId !== 'local-portfolio' ? `?pid=${portfolioId}` : ''}`} className="hover:text-primary transition-colors py-[16px]">{t('nav.transactions')}</a>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="hidden sm:block">
            <GlobalSearch />
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="hidden md:block">
              {/* Removed LanguageSwitcher */}
            </div>
            {/* Mobile Search Trigger */}
            <button 
              onClick={() => setShowMobileSearch(true)}
              className="sm:hidden w-7 h-7 rounded-full bg-element-hover border border-border flex items-center justify-center text-secondary active:bg-gray-200 transition-colors shadow-sm"
              title={t('header.search')}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Mobile Transactions Link */}
            <Link
              href={`/transactions${portfolioId !== 'local-portfolio' ? `?pid=${portfolioId}` : ''}`}
              className="md:hidden w-7 h-7 rounded-full bg-element-hover border border-border flex items-center justify-center text-secondary active:bg-gray-200 transition-colors shadow-sm"
              title={t('nav.transactions')}
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
                    {t('account.guest')}
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
        <div className="flex justify-between items-center mb-6 gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            {portfolios.length > 1 ? (
              <PortfolioSwitcher
                portfolios={portfolios}
                currentId={portfolioId}
                variant="title"
              />
            ) : (
              <h1 className="text-[24px] sm:text-[28px] font-bold text-primary tracking-tight leading-tight">
                {portfolioName || t('header.portfolioFallback')}
              </h1>
            )}
            <span className={`hidden sm:inline-block text-[13px] font-medium px-2 py-0.5 rounded-md transition-colors shrink-0 ${isRateLimited ? 'text-rose-500 bg-rose-50/50' : 'text-secondary bg-element-hover'}`}>
              {isRateLimited ? t('header.apiLimitReached') : t('header.realTime')}
            </span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 w-9 flex items-center justify-center bg-card text-secondary rounded-xl border border-border hover:text-primary hover:bg-element-hover transition-all active:scale-90 disabled:opacity-50 shadow-sm"
              title={t('header.realTime')}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="h-9 px-2.5 sm:px-4 bg-primary text-on-primary text-[13px] font-bold rounded-xl hover:bg-primary-hover transition-all active:scale-95 shadow-sm flex items-center space-x-0 sm:space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline-block">{t('header.addTrade')}</span>
            </button>
          </div>
        </div>

        {/* Pending Dividends Notification Banner */}
        {pendingDividendCount > 0 && portfolioId !== 'local-portfolio' && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700 ease-out">
            <div 
              onClick={() => setIsDividendModalOpen(true)}
              className="group cursor-pointer relative overflow-hidden bg-card/70 backdrop-blur-xl border border-border/50 rounded-3xl p-4 sm:p-5 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.98] shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
            >
              {/* Subtle background glow */}
              <div className="absolute -left-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex items-center space-x-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-on-primary shadow-lg shadow-primary/20 group-hover:rotate-6 transition-transform duration-500">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-primary tracking-tight leading-tight mb-0.5">{t('pendingDividends.title')}</h3>
                  <p className="text-[13px] text-secondary font-medium opacity-80">{t('pendingDividends.description', { count: pendingDividendCount })}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 relative z-10">
                <div className="hidden sm:flex px-4 py-1.5 bg-element text-primary text-[12px] font-bold rounded-full transition-colors group-hover:bg-element-hover">
                  {t('pendingDividends.reviewNow')}
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-secondary group-hover:translate-x-1 transition-transform">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        ) }

        {totalHoldingsCount === 0 ? (
          /* 空状态面板 */
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border shadow-sm relative w-full my-4">
            <div className="w-16 h-16 bg-element rounded-full flex items-center justify-center mb-6">
              <Wallet className="w-8 h-8 text-secondary" />
            </div>
            <h2 className="text-2xl font-bold text-primary tracking-tight mb-2">{t('empty.title')}</h2>
            <p className="text-sm text-secondary mb-8 max-w-[280px] text-center">
              {t('empty.description')}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-8 py-3 bg-primary text-on-primary text-sm font-semibold rounded-full hover:bg-primary-hover transition-all shadow-sm flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('empty.cta')}</span>
            </button>
            <p className="text-xs text-secondary mt-6 font-medium">{portfolioId === 'local-portfolio' ? t('empty.localHint') : t('empty.accountHint')}</p>
          </div>
        ) : (
          <>
            {/* 顶部网格：核心指标 + 图表 - 两栏布局以提高密度 */}
            <div className="grid grid-cols-12 gap-5 mb-5">
          
          {/* 左侧：核心指标垂直排列 */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm relative overflow-hidden group">
              <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">{t('summary.portfolioValue')}</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-[28px] font-bold text-primary tracking-tight tabular-nums">
                  {fmt(localSummary.totalValue)}
                </span>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${upColor.tailwind.bgLight} ${upColor.tailwind.text}`} title={t('summary.totalReturnWithDividends')}>
                  {isUp ? '+' : ''}{totalReturnPct.toFixed(2)}%
                </span>
                <span className="text-[12px] font-medium text-secondary tabular-nums">
                  ({isUp ? '+' : '-'}{fmt(Math.abs(totalReturnAbs))})
                </span>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
              <div>
                <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">{t('summary.unrealizedPnL')}</p>
                <div className="flex items-baseline">
                  <span className={`text-[20px] font-bold tracking-tight tabular-nums ${unrealizedColor.tailwind.text}`}>
                    {isUnrealizedUp ? '+' : '-'}{fmt(Math.abs(localSummary.totalCapGain))}
                  </span>
                </div>
                <p className="text-secondary text-[11px] font-medium mt-0.5">{t('summary.openPositions')}</p>
              </div>
              <div className="border-t border-border" />
              <div>
                <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">{t('summary.realizedPnL')}</p>
                <div className="flex items-baseline">
                  <span className={`text-[20px] font-bold tracking-tight tabular-nums ${safeRealizedGain === 0 ? 'text-secondary' : realizedColor.tailwind.text}`}>
                    {safeRealizedGain === 0 ? '' : (isRealizedUp ? '+' : '-')}{fmt(Math.abs(safeRealizedGain))}
                  </span>
                </div>
                <p className="text-secondary text-[11px] font-medium mt-0.5">{t('summary.closedPositions')}</p>
              </div>
              <div className="border-t border-border" />
              <div 
                onClick={() => setIsDividendModalOpen(true)}
                className="group/div cursor-pointer p-2 -m-2 rounded-xl hover:bg-element/50 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] text-secondary font-bold uppercase tracking-wider">{t('summary.dividendsCollected')}</p>
                  <DollarSign className="w-3.5 h-3.5 text-secondary opacity-0 group-hover/div:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className={`text-[20px] font-bold tracking-tight tabular-nums ${localSummary.totalDividendIncome > 0 ? colors.gain.tailwind.text : 'text-secondary'}`}>
                    {localSummary.totalDividendIncome > 0 ? '+' : ''}{fmt(localSummary.totalDividendIncome || 0)}
                  </span>
                </div>
                <p className="text-secondary text-[11px] font-medium mt-0.5">{t('summary.cashFlow')}</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">{t('summary.assets')}</p>
                <p className="text-[22px] font-bold text-primary tracking-tight">{totalHoldingsCount}</p>
              </div>
              <div className="flex -space-x-1.5">
                {localHoldings.flatMap(g => g.holdings).slice(0, 3).map((h) => (
                  <div key={h.ticker} className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-[9px] font-bold text-secondary shadow-sm overflow-hidden z-10">
                    <CachedAssetLogo
                      ticker={h.ticker}
                      logoUrl={h.logo}
                      size={28}
                      loading="eager"
                      fallbackClassName="font-bold text-[9px] text-secondary"
                    />
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
                <div className="flex flex-row justify-between items-start gap-2">
                  <div>
                    <h2 className="text-[15px] font-bold text-primary tracking-tight leading-none">{t('chart.performanceHistory')}</h2>
                    <p className={`text-[12px] font-medium mt-1 ${chartSubtitle.className}`}>
                      {chartSubtitle.text}
                    </p>
                  </div>
                  {portfolioId !== 'local-portfolio' && (
                    <div className="flex items-center shrink-0">
                      <div className="flex bg-element rounded-lg p-0.5 border border-border">
                        {(['value', 'return'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setChartMode(mode)}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all whitespace-nowrap ${
                              chartMode === mode ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:text-primary'
                            }`}
                          >
                            {mode === 'value' ? t('chart.value') : t('chart.returnPercent')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {chartMode === 'return' && portfolioId !== 'local-portfolio' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-secondary font-medium">vs</span>
                    {(['SPY', 'QQQ'] as const).map((idx) => (
                      <button
                        key={idx}
                        onClick={() => setBenchmark(benchmark === idx ? null : idx)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                          benchmark === idx
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-element border-border text-secondary hover:text-primary'
                        }`}
                      >
                        {idx === 'SPY' ? 'S&P 500' : 'NASDAQ 100'}
                      </button>
                    ))}
                  </div>
                )}
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
                    const firstPoint = chartDisplayData.find((point: ChartPoint) => point.date !== 'Today');
                    const lastPoint = chartDisplayData[chartDisplayData.length - 1];
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
                      <AreaChart data={chartDisplayData} margin={{ top: 10, right: 52, left: 0, bottom: 0 }}>
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
                          tick={<CustomXAxisTick locale={locale} todayLabel={t('chart.today')} />}
                          interval="equidistantPreserveStart"
                          minTickGap={20}
                        />
                        <YAxis hide domain={[yTicks[0] ?? 'auto', yTicks[yTicks.length - 1] ?? 'auto']} ticks={yTicks} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 20px -5px rgb(0 0 0 / 0.2)', backgroundColor: 'var(--bg-card)', backdropFilter: 'blur(8px)', padding: '10px' }}
                          itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0', color: 'var(--text-primary)' }}
                          labelStyle={{ marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '600' }}
                          labelFormatter={(dateStr) => {
                            if (dateStr === 'Today') return t('chart.today');
                            const d = new Date(dateStr);
                            if (isNaN(d.getTime())) return dateStr;
                            return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
                          }}
                          formatter={(value: number | string | undefined, name?: string) => {
                            const numVal = Number(value ?? 0);
                            if (name === 'SPY') return [`${numVal >= 0 ? '+' : ''}${numVal.toFixed(2)}%`, 'S&P 500'];
                            if (name === 'QQQ') return [`${numVal >= 0 ? '+' : ''}${numVal.toFixed(2)}%`, 'NASDAQ 100'];
                            return chartMode === 'return'
                              ? [`${numVal >= 0 ? '+' : ''}${numVal.toFixed(2)}%`, t('chart.returnPercent')]
                              : [`${fmt(numVal)}`, t('chart.value')];
                          }}
                        />
                        {portfolioId === 'local-portfolio' ? (
                          <Area type="monotone" dataKey="Local" stroke={chartColorHex} strokeWidth={2} fill="var(--bg-element)" fillOpacity={1} activeDot={{ r: 4, strokeWidth: 0, fill: chartColorHex }} />
                        ) : (
                          <Area type="monotone" dataKey={chartMode === 'return' ? 'Return' : 'Total'} stroke={chartColorHex} strokeWidth={2} fill="url(#colorTotal)" activeDot={{ r: 4, strokeWidth: 0, fill: chartColorHex }} />
                        )}
                        {benchmark && chartMode === 'return' && (
                          <Line
                            type="monotone"
                            dataKey={benchmark}
                            stroke="var(--text-secondary)"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            dot={false}
                            activeDot={{ r: 3, strokeWidth: 0 }}
                          />
                        )}
                      </AreaChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>

              {/* Bottom Time Range Switcher */}
              <div className="mt-6 flex justify-center">
                <div className="flex bg-element/50 p-1 rounded-2xl gap-1 border border-border/50">
                  {(['1M', '3M', '6M', '1Y', 'All'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setChartTimeRange(range)}
                      className={`px-4 py-1.5 text-[12px] font-medium rounded-xl transition-all whitespace-nowrap ${
                        chartTimeRange === range
                          ? 'bg-white dark:bg-zinc-100 text-black shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                          : 'text-secondary hover:text-primary'
                      }`}
                    >
                      {range === 'All' ? t('chart.all') : range}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 持仓明细表 - 高密度列表设计 */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="text-[15px] font-bold text-primary tracking-tight">{t('holdings.title')}</h2>
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
              <div className="text-[11px] text-secondary font-medium hidden sm:block">{t('holdings.sortedByMarket')}</div>
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-element/50 text-[10px] font-bold text-secondary uppercase tracking-widest border-b border-border">
                  <th className="px-4 sm:px-6 py-3">{t('holdings.asset')}</th>
                  <th className="px-4 sm:px-6 py-3 text-right hidden md:table-cell">{t('holdings.marketPrice')}</th>
                  <th className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">{t('holdings.position')}</th>
                  <th className="px-4 sm:px-6 py-3 text-right">{t('holdings.value')}</th>
                  <th className="px-4 sm:px-6 py-3 text-right">{t('holdings.return')}</th>
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
                              <CachedAssetLogo
                                ticker={asset.ticker}
                                logoUrl={asset.logo}
                                size={32}
                                loading="lazy"
                                fallbackClassName="font-bold text-[11px] text-primary"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-primary text-[14px] leading-tight group-hover:underline underline-offset-2">{asset.ticker}</div>
                              <div className="text-[11px] text-secondary font-medium truncate max-w-[90px] sm:max-w-[200px]">{asset.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-[13px] font-semibold tabular-nums text-primary hidden md:table-cell">{asset.price > 0 ? fmt(asset.price) : '--'}</td>
                        <td className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">
                          <div className="text-[13px] font-semibold text-primary tabular-nums">{asset.qty.toLocaleString(locale)}</div>
                          <div className="text-[10px] text-secondary font-medium">{t('holdings.shares')}</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          <div className="text-[13px] font-bold text-primary tabular-nums">{asset.price > 0 ? fmt(asset.value) : '--'}</div>
                          <div className="text-[10px] text-secondary font-medium sm:hidden">{t('holdings.value')}</div>
                          <div className="text-[10px] text-secondary font-medium hidden sm:block">{t('holdings.marketValue')}</div>
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
                          <div className="text-[10px] text-secondary font-medium hidden sm:block">{t('holdings.sincePurchase')}</div>
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
                  <td className="px-4 sm:px-6 py-4 text-[13px] text-primary">{t('holdings.total')}</td>
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
          setPendingDividendCountOverride({
            portfolioId,
            count: 0,
          });
          window.location.reload();
        }}
      />
    </div>
  );
}
