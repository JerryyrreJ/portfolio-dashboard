"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowDownRight
} from 'lucide-react';
import AddTransactionModal from './components/AddTransactionModal';
import Link from 'next/link';

// --- 辅助格式化组件 ---
interface FormatValueProps {
  val: number;
  isPercentage?: boolean;
  isCurrency?: boolean;
}

const FormatValue: React.FC<FormatValueProps> = ({ val, isPercentage = false, isCurrency = true }) => {
  if (val === 0) return <span className="text-gray-400">{isCurrency ? '$' : ''}0.00{isPercentage ? '%' : ''}</span>;
  const isPositive = val > 0;
  const color = isPositive ? 'text-emerald-600' : 'text-rose-500';
  const prefix = isCurrency ? (val < 0 ? '-$' : '$') : '';
  const displayVal = Math.abs(val).toFixed(2);
  
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
  logo?: string;
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
  portfolioId: string;
  portfolioName: string;
  holdingsData: HoldingsGroup[];
  chartData: any[];
  summary: Summary;
}

// 颜色配置 - 雅致但不沉闷的 Apple 风格色彩
const MARKET_COLORS: Record<string, { stroke: string; fill: string; dot: string }> = {
  'NASDAQ': { stroke: '#34C759', fill: 'rgba(52, 199, 89, 0.1)', dot: 'bg-[#34C759]' }, // Apple Green
  'NYSE': { stroke: '#007AFF', fill: 'rgba(0, 122, 255, 0.1)', dot: 'bg-[#007AFF]' },   // Apple Blue
  'OTC': { stroke: '#FF9500', fill: 'rgba(255, 149, 0, 0.1)', dot: 'bg-[#FF9500]' },    // Apple Orange
  'Other': { stroke: '#AF52DE', fill: 'rgba(175, 82, 222, 0.1)', dot: 'bg-[#AF52DE]' }  // Apple Purple (Used sparingly)
};

export default function DashboardClient({ portfolioId, portfolioName, holdingsData, chartData, summary }: DashboardClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 图表时间范围状态
  const [chartTimeRange, setChartTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'All'>('All');
  const [filteredChartData, setFilteredChartData] = useState(chartData);

  useEffect(() => {
    if (chartTimeRange === 'All') {
      setFilteredChartData(chartData);
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
    const filtered = chartData.filter(item => new Date(item.date) >= startDate);
    setFilteredChartData(filtered);
  }, [chartTimeRange, chartData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  const isUp = summary.totalCapGain >= 0;
  const totalHoldingsCount = holdingsData.reduce((sum, g) => sum + g.holdings.length, 0);

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">
      
      {/* 顶部导航栏 - 更舒适的高度和字体 */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight">
            <div className="bg-black text-white p-1 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span>PortfolioUI</span>
          </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-400">
            <a href="/" className="text-black border-b-2 border-black py-[16px]">Investments</a>
            <a href="/transactions" className="hover:text-black transition-colors py-[16px]">Transactions</a>
            <a href="#" className="hover:text-black transition-colors py-[16px]">History</a>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-gray-400" />
            <input 
              type="text" 
              placeholder="Search" 
              className="bg-gray-100 border-none rounded-lg py-1.5 pl-9 pr-4 text-[13px] w-44 focus:w-60 focus:ring-1 focus:ring-black/5 focus:bg-white transition-all duration-300"
            />
          </div>
          {/* Account Link - Direct navigation to settings */}
          <Link 
            href="/settings"
            className="flex items-center space-x-2.5 group transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 group-hover:border-gray-400 transition-colors shadow-sm overflow-hidden">
              JD
            </div>
            <span className="text-[13px] font-bold text-gray-500 group-hover:text-black transition-colors hidden sm:block">John Doe</span>
          </Link>
        </div>
      </header>

      {/* 主内容区域 - 减小内边距 */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        
        {/* 标题 & 操作按钮 - 紧凑布局 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-baseline space-x-3">
            <h1 className="text-[28px] font-bold text-black tracking-tight leading-none">{portfolioName}</h1>
            <span className="text-[13px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-md">Real-time</span>
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

        {/* 顶部网格：核心指标 + 图表 - 两栏布局以提高密度 */}
        <div className="grid grid-cols-12 gap-5 mb-5">
          
          {/* 左侧：核心指标垂直排列 */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Portfolio Value</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-[28px] font-bold text-black tracking-tight tabular-nums">
                  ${summary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                  {isUp ? '▲' : '▼'} {Math.abs(summary.totalCapGainPercentage).toFixed(2)}%
                </span>
                <span className="text-gray-400 text-[11px] font-medium">All-time</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Gain</p>
              <div className="flex items-baseline">
                <span className={`text-[22px] font-bold tracking-tight tabular-nums ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {isUp ? '+' : '-'}${Math.abs(summary.totalCapGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-gray-400 text-[11px] font-medium mt-1">Net profit/loss</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Assets</p>
                <p className="text-[22px] font-bold text-black tracking-tight">{totalHoldingsCount}</p>
              </div>
              <div className="flex -space-x-1.5">
                {holdingsData.flatMap(g => g.holdings).slice(0, 3).map((h) => (
                  <div key={h.ticker} className="w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-600 shadow-sm">
                    {h.ticker.charAt(0)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：图表占据大块空间 */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-[15px] font-bold text-black tracking-tight leading-none">Performance History</h2>
                  <p className="text-[12px] text-gray-400 font-medium mt-1">Value stacked by market</p>
                </div>
                <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                  {(['1M', '3M', '6M', '1Y', 'All'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setChartTimeRange(range)}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
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

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredChartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      {Object.keys(MARKET_COLORS).map(market => (
                        <linearGradient key={market} id={`color${market}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={MARKET_COLORS[market]?.stroke || '#000'} stopOpacity={0.15}/>
                          <stop offset="95%" stopColor={MARKET_COLORS[market]?.stroke || '#000'} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 500 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 500 }} width={60} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px -5px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', padding: '10px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0' }}
                      labelStyle={{ marginBottom: '4px', color: '#888', fontSize: '10px', fontWeight: '600' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
                    />                    {Array.from(new Set(holdingsData.map(g => g.market))).map((market) => {
                      const color = MARKET_COLORS[market] || MARKET_COLORS['Other'];
                      return (
                        <Area 
                          key={market} 
                          type="monotone" 
                          dataKey={market} 
                          stackId="1" 
                          stroke={color.stroke} 
                          strokeWidth={2} 
                          fill={`url(#color${market})`} 
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                      )
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex justify-start items-center space-x-4 mt-4">
                {Array.from(new Set(holdingsData.map(g => g.market))).map((market) => {
                  const color = MARKET_COLORS[market] || MARKET_COLORS['Other'];
                  return (
                    <div key={market} className="flex items-center space-x-1.5">
                      <div className={`w-2 h-2 rounded-full ${color.dot}`}></div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{market}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 持仓明细表 - 高密度列表设计 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-[15px] font-bold text-black tracking-tight">Investment Holdings</h2>
            <div className="text-[11px] text-gray-400 font-medium">Sorted by Market</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-6 py-3">Asset</th>
                  <th className="px-6 py-3 text-right">Market Price</th>
                  <th className="px-6 py-3 text-right">Position</th>
                  <th className="px-6 py-3 text-right">Value</th>
                  <th className="px-6 py-3 text-right">Total Return</th>
                  <th className="px-6 py-3 text-right w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {holdingsData.map((group) => (
                  <React.Fragment key={group.market}>
                    {/* 分组标题行 */}
                    <tr className="bg-gray-50/30">
                      <td colSpan={6} className="px-6 py-2 text-[10px] font-bold text-gray-400 bg-gray-50/20">
                        {group.market}
                      </td>
                    </tr>
                    {group.holdings.map((asset) => (
                      <tr 
                        key={asset.ticker} 
                        className="hover:bg-gray-50/80 transition-all cursor-pointer group" 
                        onClick={() => router.push(`/stock/${asset.ticker}`)}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-[11px] text-gray-900 border border-gray-100 shadow-sm overflow-hidden">
                              {asset.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={asset.logo} alt={asset.ticker} className="w-full h-full object-cover" />
                              ) : (
                                asset.ticker.charAt(0)
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-black text-[14px] leading-tight group-hover:underline underline-offset-2">{asset.ticker}</div>
                              <div className="text-[11px] text-gray-400 font-medium truncate max-w-[200px]">{asset.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right text-[13px] font-semibold tabular-nums text-gray-900">${asset.price.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right">
                          <div className="text-[13px] font-semibold text-gray-900 tabular-nums">{asset.qty.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-400 font-medium">Shares</div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="text-[13px] font-bold text-black tabular-nums">${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div className="text-[10px] text-gray-400 font-medium">Market Value</div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <FormatValue val={asset.return} isPercentage={true} isCurrency={false} />
                          <div className="text-[10px] text-gray-400 font-medium">Since purchase</div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-black transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-black/[0.02] font-bold border-t border-gray-100">
                  <td className="px-6 py-4 text-[13px] text-black">Total Portfolio</td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-right text-[15px] text-black tabular-nums">${summary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right">
                    <FormatValue val={summary.totalCapGainPercentage} isPercentage={true} isCurrency={false} />
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center px-2">
          <div className="text-[11px] text-gray-400 font-medium">
            Synced with Finnhub Real-time API
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-gray-400 font-medium">
            <a href="#" className="hover:text-black transition-colors">Privacy</a>
            <a href="#" className="hover:text-black transition-colors">Legal</a>
            <a href="#" className="hover:text-black transition-colors">Support</a>
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