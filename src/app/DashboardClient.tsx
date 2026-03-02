"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
  LayoutGrid,
  Settings,
  HelpCircle,
  Bell,
  RefreshCw,
  Loader2
} from 'lucide-react';
import AddTransactionModal from './components/AddTransactionModal';

// --- 辅助格式化组件 ---
interface FormatValueProps {
  val: number;
  isPercentage?: boolean;
  isCurrency?: boolean;
}

const FormatValue: React.FC<FormatValueProps> = ({ val, isPercentage = false, isCurrency = true }) => {
  if (val === 0) return <span className="text-gray-400">{isCurrency ? '$' : ''}0.00{isPercentage ? '%' : ''}</span>;
  const isPositive = val > 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  const prefix = isCurrency ? (val < 0 ? '-$' : '$') : '';
  const displayVal = Math.abs(val).toFixed(2);
  
  return (
    <span className={`font-medium ${color}`}>
      {val > 0 && !isCurrency ? '+' : ''}{prefix}{displayVal}{isPercentage ? '%' : ''}
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
}

interface HoldingsGroup {
  market: string;
  holdings: Asset[];
}

interface Summary {
  totalValue: number;
  totalCapGain: number;
  totalCapGainPercentage: number;
}

interface DashboardClientProps {
  portfolioId: number;
  portfolioName: string;
  holdingsData: HoldingsGroup[];
  chartData: any[];
  summary: Summary;
}

export default function DashboardClient({ portfolioId, portfolioName, holdingsData, chartData, summary }: DashboardClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // 图表时间范围状态
  const [chartTimeRange, setChartTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'All'>('All');
  const [filteredChartData, setFilteredChartData] = useState(chartData);

  // 根据时间范围过滤图表数据
  useEffect(() => {
    if (chartTimeRange === 'All') {
      setFilteredChartData(chartData);
      return;
    }

    const now = new Date();
    let startDate = new Date();

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

    const filtered = chartData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate;
    });

    setFilteredChartData(filtered);
  }, [chartTimeRange, chartData]);

  // 手动刷新数据
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 使用 router.refresh() 来触发服务器端重新获取数据
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 自动刷新间隔设置（秒）
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 表示关闭
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState<number>(0);

  // 根据时间范围过滤图表数据
  useEffect(() => {
    if (chartTimeRange === 'All') {
      setFilteredChartData(chartData);
      return;
    }

    const now = new Date();
    let startDate = new Date();

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

    const filtered = chartData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate;
    });

    setFilteredChartData(filtered);
  }, [chartTimeRange, chartData]);

  // 根据时间范围过滤图表数据
  useEffect(() => {
    if (chartTimeRange === 'All') {
      setFilteredChartData(chartData);
      return;
    }

    const now = new Date();
    let startDate = new Date();

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

    const filtered = chartData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate;
    });

    setFilteredChartData(filtered);
  }, [chartTimeRange, chartData]);

  // 自动刷新数据（每60秒）
  useEffect(() => {
    const interval = setInterval(() => {
      // 更新最后更新时间
      setLastUpdated(new Date());
    }, 60000); // 每分钟更新一次显示时间

    return () => clearInterval(interval);
  }, []);

  // 自动刷新倒计时
  useEffect(() => {
    if (autoRefreshInterval <= 0) {
      setCountdown(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const nextRefresh = new Date(lastRefreshTime.getTime() + autoRefreshInterval * 1000);
      const remaining = Math.max(0, Math.ceil((nextRefresh.getTime() - now.getTime()) / 1000));

      setCountdown(remaining);

      if (remaining === 0) {
        // 触发刷新
        handleRefresh();
        setLastRefreshTime(new Date());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshInterval, lastRefreshTime]);

  // 根据时间范围过滤图表数据
  useEffect(() => {
    if (chartTimeRange === 'All') {
      setFilteredChartData(chartData);
      return;
    }

    const now = new Date();
    let startDate = new Date();

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

    const filtered = chartData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate;
    });

    setFilteredChartData(filtered);
  }, [chartTimeRange, chartData]);

  // 格式化时间显示
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 120) return '1 minute ago';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 7200) return '1 hour ago';
    return `${Math.floor(diff / 3600)} hours ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2 text-orange-600 font-bold text-xl tracking-tight">
            <LayoutGrid className="w-6 h-6" />
            <span>PortfolioUI</span>
          </div>
          <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-600">
            <a href="/" className="text-blue-600 border-b-2 border-blue-600 py-5">Investments</a>
            <a href="/transactions" className="hover:text-gray-900 py-5">Transactions</a>
            <a href="#" className="hover:text-gray-900 py-5">Tools</a>
            <a href="#" className="hover:text-gray-900 py-5">Tax</a>
            <a href="#" className="hover:text-gray-900 py-5">Settings</a>
          </nav>
        </div>
        <div className="flex items-center space-x-6">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search for investments..." 
              className="w-full bg-gray-50 border border-gray-200 rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center space-x-4 border-l border-gray-200 pl-4 text-sm font-medium cursor-pointer">
            <div className="flex items-center space-x-1">
              <span>{portfolioName}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex items-center space-x-1">
              <span>Account</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        
        {/* 标题 & 操作按钮 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-serif text-gray-900 tracking-tight">{portfolioName}</h1>
          <div className="flex items-center space-x-3">
            {/* 自动刷新设置 */}
            <select
              value={autoRefreshInterval}
              onChange={(e) => {
                setAutoRefreshInterval(Number(e.target.value));
                setLastRefreshTime(new Date());
              }}
              className="px-3 py-2 bg-gray-50 text-gray-700 text-sm font-medium rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <option value={0}>Auto Refresh: Off</option>
              <option value={30}>Auto Refresh: 30s</option>
              <option value={60}>Auto Refresh: 1m</option>
              <option value={300}>Auto Refresh: 5m</option>
            </select>

            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md border border-gray-200 hover:bg-gray-200 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
              {countdown > 0 && <span className="text-xs text-gray-500">({countdown}s)</span>}
            </button>

            <button className="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-medium rounded-md border border-indigo-100 hover:bg-indigo-100 transition-colors">
              Share checker
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-indigo-700 flex items-center space-x-1 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Trade</span>
            </button>
          </div>
        </div>

        {/* 过滤器 & 概览卡片区域 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
          {/* 核心指标 */}
          <div className="grid grid-cols-5 gap-6 p-6 border-b border-gray-100">
            <div>
              <p className="text-sm text-gray-500 mb-1">Portfolio value</p>
              <p className="text-2xl font-semibold text-gray-900">US${summary.totalValue.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">Live simulation</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Capital gain</p>
              <p className={`text-lg font-semibold ${summary.totalCapGain > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.totalCapGainPercentage > 0 ? '+' : ''}{summary.totalCapGainPercentage.toFixed(2)}%
              </p>
              <p className={`text-sm ${summary.totalCapGain > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.totalCapGain > 0 ? '+$' : '-$'}{Math.abs(summary.totalCapGain).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Income</p>
              <p className="text-lg font-semibold text-gray-900">0.00%</p>
              <p className="text-sm text-gray-400">$0.00</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Currency gain</p>
              <p className="text-lg font-semibold text-gray-900">0.00%</p>
              <p className="text-sm text-gray-400">$0.00</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Total return</p>
              <p className={`text-lg font-semibold ${summary.totalCapGain > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.totalCapGainPercentage > 0 ? '+' : ''}{summary.totalCapGainPercentage.toFixed(2)}%
              </p>
              <p className={`text-sm ${summary.totalCapGain > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.totalCapGain > 0 ? '+$' : '-$'}{Math.abs(summary.totalCapGain).toFixed(2)}
              </p>
            </div>
          </div>

          {/* 图表区域 */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Investment value - stacked</h2>
                <p className="text-sm text-gray-500">Since first purchase | Grouped by Market</p>
              </div>
              <div className="flex items-center space-x-3">
                {/* 时间范围选择 */}
                <div className="flex bg-gray-100 rounded-lg p-1 space-x-1">
                  {(['1M', '3M', '6M', '1Y', 'All'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setChartTimeRange(range)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        chartTimeRange === range
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <button className="border border-gray-200 rounded-md px-3 py-1.5 flex items-center space-x-2 text-sm text-gray-700 bg-white hover:bg-gray-50 shadow-sm">
                  <span>Value - Stacked</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [Number(value).toFixed(2), '']} />
                  {/* 动态渲染包含的市场 */}
                  {Array.from(new Set(holdingsData.map(g => g.market))).map((market, idx) => {
                    const colors = [
                      { stroke: '#6b7280', fill: '#e5e7eb' }, // Gray
                      { stroke: '#f87171', fill: '#fecaca' }, // NASDAQ (red)
                      { stroke: '#fbbf24', fill: '#fde68a' }, // OTC (yellow)
                      { stroke: '#60a5fa', fill: '#bfdbfe' }, // Others (blue)
                    ];
                    const color = colors[idx % colors.length];
                    return (
                      <Area key={market} type="monotone" dataKey={market} stackId="1" stroke={color.stroke} fill={color.fill} />
                    )
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* 图例 */}
            <div className="flex justify-center items-center space-x-6 mt-4 text-xs font-medium text-gray-600 uppercase tracking-wider">
              {Array.from(new Set(holdingsData.map(g => g.market))).map((market, idx) => {
                const bgColors = ['bg-purple-400', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400'];
                return (
                  <div key={market} className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${bgColors[idx % bgColors.length]}`}></div>
                    <span>{market}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 持仓明细表 */}
        <div className="mb-6">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Your investments</h2>
              <p className="text-sm text-gray-500">Live Database Synced | Grouped by Market</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {holdingsData.map((group, i) => {
              const groupValue = group.holdings.reduce((sum, h) => sum + h.value, 0);
              const groupCapGain = group.holdings.reduce((sum, h) => sum + h.capGain, 0);

              return (
              <div key={group.market} className="mb-0">
                {/* 市场分组表头 */}
                <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider flex">
                  <div className="flex-1">{group.market} ↑↓</div>
                  <div className="w-24 text-right">PRICE</div>
                  <div className="w-24 text-right">QUANTITY</div>
                  <div className="w-24 text-right">VALUE</div>
                  <div className="w-28 text-right">CAPITAL GAINS</div>
                  <div className="w-24 text-right">INCOME</div>
                  <div className="w-24 text-right">CURRENCY</div>
                  <div className="w-28 text-right">RETURN</div>
                </div>
                
                {/* 数据行 */}
                {group.holdings.map((asset, j) => (
                  <div key={asset.ticker} className="flex items-center px-4 py-4 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <div className="flex-1 flex items-center space-x-3">
                      <div className="w-8 h-8 rounded border border-gray-200 bg-white shadow-sm flex items-center justify-center font-bold text-xs text-gray-600">
                        {asset.ticker.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-indigo-600 text-sm hover:underline cursor-pointer">{asset.ticker}</div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{asset.name}</div>
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm">US${asset.price.toFixed(2)}</div>
                    <div className="w-24 text-right text-sm text-gray-700">{asset.qty.toFixed(4).replace(/\.?0+$/, '')}</div>
                    <div className="w-24 text-right text-sm font-semibold text-gray-900">${asset.value.toFixed(2)}</div>
                    <div className="w-28 text-right text-sm"><FormatValue val={asset.capGain} /></div>
                    <div className="w-24 text-right text-sm"><FormatValue val={0} /></div>
                    <div className="w-24 text-right text-sm"><FormatValue val={0} /></div>
                    <div className="w-28 text-right text-sm font-medium"><FormatValue val={asset.return} /></div>
                  </div>
                ))}
                
                {/* 分组汇总 */}
                <div className="flex items-center px-4 py-3 border-b-2 border-gray-200 bg-white font-semibold">
                  <div className="flex-1 text-sm text-gray-900">Total (US$)</div>
                  <div className="w-24 text-right"></div>
                  <div className="w-24 text-right"></div>
                  <div className="w-24 text-right text-sm text-gray-900">${groupValue.toFixed(2)}</div>
                  <div className="w-28 text-right text-sm"><FormatValue val={groupCapGain} /></div>
                  <div className="w-24 text-right text-sm"><FormatValue val={0} /></div>
                  <div className="w-24 text-right text-sm"><FormatValue val={0} /></div>
                  <div className="w-28 text-right text-sm"><FormatValue val={groupCapGain} /></div>
                </div>
              </div>
            )})}
            
            {/* 总计 */}
            <div className="flex items-center px-4 py-4 bg-gray-50/50 font-bold">
              <div className="flex-1 text-sm text-gray-900">Grand Total (US$)</div>
              <div className="w-24 text-right"></div>
              <div className="w-24 text-right"></div>
              <div className="w-24 text-right text-sm text-gray-900">${summary.totalValue.toFixed(2)}</div>
              <div className="w-28 text-right text-sm"><FormatValue val={summary.totalCapGain} /></div>
              <div className="w-24 text-right text-sm"><FormatValue val={0} /></div>
              <div className="w-24 text-right text-sm"><FormatValue val={0} /></div>
              <div className="w-28 text-right text-sm font-bold"><FormatValue val={summary.totalCapGain} /></div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            <p>Percentage returns are calculated using the simple method against the cost basis.</p>
            <p>Data powered by Prisma & SQLite.</p>
          </div>
        </div>

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