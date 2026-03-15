'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Search as SearchIcon, Loader2, TrendingUp, TrendingDown, Calendar as CalendarIcon, DollarSign, AlertCircle, CheckCircle, ChevronRight, Hash, ChevronLeft, ChevronDown } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, eachDayOfInterval } from 'date-fns';
import { useStock } from '@/hooks/useStock';
import { useCurrency } from '@/lib/useCurrency';
import { getCurrencySymbol } from '@/lib/currency';

function inferCurrencyFromTicker(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith('.HK'))               return 'HKD';
  if (s.endsWith('.SS') || s.endsWith('.SZ')) return 'CNY';
  if (s.endsWith('.L') || s.endsWith('.LON')) return 'GBP';
  if (s.endsWith('.T'))                return 'JPY';
  if (s.endsWith('.AX'))               return 'AUD';
  if (s.endsWith('.TO') || s.endsWith('.V')) return 'CAD';
  if (s.endsWith('.SW'))               return 'CHF';
  if (s.endsWith('.SI'))               return 'SGD';
  return 'USD';
}

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'HKD', name: 'HK Dollar' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'AUD' },
  { code: 'CAD', name: 'CAD' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'SGD', name: 'SGD' },
];

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioName: string;
  portfolioId: string;
}

interface SearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  portfolioName,
  portfolioId
}: AddTransactionModalProps) {
  const { searchStock, getQuote, getHistoricalPrice, isLoading } = useStock();
  const { rates } = useCurrency();
  const calendarRef = useRef<HTMLDivElement>(null);

  // 表单状态
  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY');
  const [symbol, setSymbol] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);

  // 货币
  const [txCurrency, setTxCurrency] = useState('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // 日期相关
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 价格和数量
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [fees, setFees] = useState('0');
  const [notes, setNotes] = useState('');

  // 状态
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceSource, setPriceSource] = useState<'api' | 'manual'>('manual');
  const [holdings, setHoldings] = useState<Array<{ ticker: string; quantity: number }>>([]);

  // 点击外部关闭日历
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchHoldings = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const response = await fetch(`/api/holdings?portfolioId=${portfolioId}`);
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
      }
    } catch (error) {
      console.error('Error fetching holdings:', error);
    }
  }, [portfolioId]);

  const getAvailableShares = useCallback((ticker: string): number => {
    const holding = holdings.find(h => h.ticker === ticker);
    return holding ? holding.quantity : 0;
  }, [holdings]);

  useEffect(() => {
    if (isOpen) {
      fetchHoldings();
      setPurchaseDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, fetchHoldings]);

  // 搜索股票逻辑
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 1 && !selectedStock) {
        const results = await searchStock(searchQuery);
        setSearchResults(results.slice(0, 8));
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchStock, selectedStock]);

  const handleSelectStock = useCallback(async (stock: SearchResult) => {
    setSelectedStock(stock);
    setSymbol(stock.symbol);
    setSearchQuery(stock.symbol);
    setShowSearchResults(false);

    setIsFetchingPrice(true);
    const today = new Date().toISOString().split('T')[0];

    // 并行：获取价格 + 自动检测货币
    const pricePromise = (async () => {
      if (purchaseDate && purchaseDate !== today) {
        const historical = await getHistoricalPrice(stock.symbol, purchaseDate);
        if (historical && historical.price > 0) {
          setPrice(historical.price.toFixed(2));
          setPriceSource('api');
          return;
        }
      }
      const quote = await getQuote(stock.symbol);
      if (quote && quote.c > 0) {
        setPrice(quote.c.toFixed(2));
        setPriceSource('api');
      }
    })();

    const currencyPromise = (async () => {
      // 先查 DB 缓存
      const lookupRes = await fetch(`/api/assets/lookup?ticker=${encodeURIComponent(stock.symbol)}`);
      if (lookupRes.ok) {
        const data = await lookupRes.json();
        if (data.currency && data.currency !== 'USD') { setTxCurrency(data.currency); return; }
      }
      // 从 Twelve Data / Finnhub 获取货币（免费套餐仅支持美股）
      const profileRes = await fetch(`/api/stock/profile?symbol=${encodeURIComponent(stock.symbol)}`);
      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.currency) { setTxCurrency(data.currency); return; }
      }
      // 最终 fallback：根据交易所后缀推断（适用于 API 不支持的非美股）
      setTxCurrency(inferCurrencyFromTicker(stock.symbol));
    })();

    await Promise.all([pricePromise, currencyPromise]);
    setIsFetchingPrice(false);
  }, [purchaseDate, getQuote, getHistoricalPrice]);

  const handleDateSelect = useCallback(async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setPurchaseDate(dateStr);
    setShowCalendar(false);

    if (selectedStock) {
      setIsFetchingPrice(true);
      const historical = await getHistoricalPrice(selectedStock.symbol, dateStr);
      if (historical && historical.price > 0) {
        setPrice(historical.price.toFixed(2));
        setPriceSource('api');
      }
      setIsFetchingPrice(false);
    }
  }, [selectedStock, getHistoricalPrice]);

  const handleReset = () => {
    setSymbol('');
    setSearchQuery('');
    setSelectedStock(null);
    setSearchResults([]);
    setPrice('');
    setShares('');
    setFees('0');
    setNotes('');
    setPriceSource('manual');
    setTxCurrency('USD');
    setShowCurrencyPicker(false);
    setSubmitStatus('idle');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) return;

    if (transactionType === 'SELL') {
      const available = getAvailableShares(selectedStock.symbol);
      if (parseFloat(shares) > available) {
        setSubmitStatus('error');
        setSubmitError(`Insufficient shares. You have ${available.toFixed(4)} available.`);
        return;
      }
    }

    setSubmitStatus('loading');
    try {
      // 检查是否登录（通过检查 cookie 或传递的 props，这里简单通过 portfolioId 判断）
      const isLocal = portfolioId === 'local-portfolio';

      if (isLocal) {
        // 1. 获取最新价格（可选，仅仅为了记录当时的 market value，这里已经有 price 了）
        // 2. 构造本地 Transaction 对象
        const newTx = {
            id: 'local_' + Date.now(),
            portfolioId: 'local-portfolio',
            assetId: 'local_asset_' + selectedStock.symbol,
            type: transactionType,
            quantity: transactionType === 'SELL' ? -Math.abs(parseFloat(shares)) : parseFloat(shares),
            price: parseFloat(price),
            fee: parseFloat(fees) || 0,
            date: new Date(purchaseDate).toISOString(),
            notes: notes || null,
            asset: {
                id: 'local_asset_' + selectedStock.symbol,
                ticker: selectedStock.symbol,
                name: selectedStock.description,
                market: 'US', // 假设
                logo: null
            }
        };

        // 3. 读取现有的 localStorage
        const storedTransactions = localStorage.getItem('local_transactions');
        let localTxs = storedTransactions ? JSON.parse(storedTransactions) : [];
        localTxs.push(newTx);

        // 4. 保存回 localStorage
        localStorage.setItem('local_transactions', JSON.stringify(localTxs));

        // 5. 触发自定义事件，通知 DashboardClient 重新加载本地数据
        window.dispatchEvent(new Event('localTransactionsUpdated'));
        
        setSubmitStatus('success');
        setTimeout(() => { handleClose(); }, 1000);
        return;
      }

      // 以下为已登录状态的网络请求逻辑
      const assetLookupRes = await fetch(`/api/assets/lookup?ticker=${encodeURIComponent(selectedStock.symbol)}`);
      let assetId: string;

      if (assetLookupRes.ok) {
        const assetData = await assetLookupRes.json();
        assetId = assetData.id;
      } else {
        const createAssetRes = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: selectedStock.symbol,
            name: selectedStock.description,
            market: 'US',
            currency: txCurrency,
          }),
        });
        const newAsset = await createAssetRes.json();
        assetId = newAsset.asset?.id ?? newAsset.id;
      }

      const rate = rates[txCurrency] ?? 1;
      const priceUSD = parseFloat(price) / rate;

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          assetId,
          type: transactionType,
          quantity: transactionType === 'SELL' ? -Math.abs(parseFloat(shares)) : parseFloat(shares),
          price: parseFloat(price),
          fee: parseFloat(fees) || 0,
          date: purchaseDate,
          notes: notes || null,
          currency: txCurrency,
          exchangeRate: rate,
          priceUSD,
        }),
      });

      if (!response.ok) throw new Error('Submission failed');
      setSubmitStatus('success');
      setTimeout(() => { handleClose(); window.location.reload(); }, 1000);
    } catch (error) {
      setSubmitStatus('error');
      setSubmitError('Failed to record transaction');
    }
  };

  const [showYearPicker, setShowYearPicker] = useState(false);

  // Calendar Components Logic
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // 生成年份范围（前后10年）
    const currentYear = currentMonth.getFullYear();
    const years = Array.from({ length: 12 }, (_, i) => currentYear - 10 + i);

    return (
      <div className="p-4 w-[300px] select-none">
        <div className="flex items-center justify-between mb-4 px-1">
          <button 
            type="button" 
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="text-[14px] font-bold text-black hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
          >
            {format(currentMonth, 'MMMM yyyy')}
            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${showYearPicker ? 'rotate-90' : ''}`} />
          </button>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
            <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>

        {showYearPicker ? (
          <div className="grid grid-cols-3 gap-2 animate-in fade-in zoom-in-95 duration-200">
            {Array.from({ length: 12 }, (_, i) => currentYear - 9 + i).map(year => (
              <button
                key={year}
                type="button"
                onClick={() => {
                  const newDate = new Date(currentMonth);
                  newDate.setFullYear(year);
                  setCurrentMonth(newDate);
                  setShowYearPicker(false);
                }}
                className={`py-3 text-[13px] font-semibold rounded-xl transition-all ${year === currentYear ? 'bg-black text-white' : 'hover:bg-gray-50 text-gray-600'}`}
              >
                {year}
              </button>
            ))}
            <div className="col-span-3 flex justify-between mt-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setFullYear(currentYear - 12);
                setCurrentMonth(newDate);
              }} className="p-1 hover:bg-gray-50 rounded text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setFullYear(currentYear + 12);
                setCurrentMonth(newDate);
              }} className="p-1 hover:bg-gray-50 rounded text-gray-400"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="text-center text-[10px] font-bold text-gray-300">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {days.map((day, i) => {
                const isSelected = isSameDay(day, new Date(purchaseDate));
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, monthStart);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`h-9 flex items-center justify-center text-[13px] rounded-xl transition-all relative
                      ${isSelected ? 'bg-black text-white font-bold' : 'hover:bg-gray-50 text-gray-700'}
                      ${!isCurrentMonth ? 'opacity-20' : ''}
                    `}
                  >
                    {format(day, 'd')}
                    {isToday && !isSelected && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-black" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all p-4">
      <div className="relative w-full max-w-[500px] bg-white rounded-[28px] sm:rounded-[32px] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.15)] border border-gray-100 overflow-y-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header - Apple Style */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8 pb-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-20">
          <div>
            <h2 className="text-[20px] sm:text-[24px] font-bold text-black tracking-tight leading-none">Record Trade</h2>
            <p className="text-[12px] sm:text-[13px] text-gray-400 font-medium mt-1.5 sm:mt-2">Portfolio: <span className="text-black font-semibold">{portfolioName}</span></p>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-300 hover:text-black transition-colors rounded-full hover:bg-gray-50 bg-gray-50/50 sm:bg-transparent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-2 sm:p-8 sm:pt-2 space-y-5 sm:space-y-6">
          
          {/* Side Switch - Full Width Colorful Toggle */}
          <div className="bg-gray-100 p-1.5 rounded-2xl flex relative h-12">
            <div 
              className={`absolute inset-1.5 w-[calc(50%-6px)] rounded-xl shadow-sm transition-all duration-300 ease-out ${
                transactionType === 'BUY' ? 'bg-emerald-500 translate-x-0' : 'bg-rose-500 translate-x-[100%]'
              }`}
            />
            <button 
              type="button" 
              onClick={() => setTransactionType('BUY')} 
              className={`flex-1 text-[14px] font-bold relative z-10 transition-colors duration-200 ${transactionType === 'BUY' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              BUY
            </button>
            <button 
              type="button" 
              onClick={() => setTransactionType('SELL')} 
              className={`flex-1 text-[14px] font-bold relative z-10 transition-colors duration-200 ${transactionType === 'SELL' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              SELL
            </button>
          </div>

          {/* Search Box */}
          <div className="relative group">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 block px-1">Ticker / Symbol</label>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-black transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (selectedStock) setSelectedStock(null); }}
                placeholder="Search symbol (e.g. AAPL)"
                className="w-full pl-11 pr-10 py-3.5 bg-gray-50 border-none rounded-[18px] text-[15px] font-semibold focus:ring-2 focus:ring-black/5 focus:bg-white transition-all outline-none"
                autoComplete="off"
              />
              {isLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-300" />}
            </div>

            {/* Suggestions */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] max-h-60 overflow-y-auto p-2">
                {searchResults.map((stock) => (
                  <button key={stock.symbol} type="button" onClick={() => handleSelectStock(stock)} className="w-full p-3 text-left hover:bg-gray-50 rounded-xl flex items-center justify-between group transition-colors">
                    <div>
                      <span className="font-bold text-black">{stock.symbol}</span>
                      <p className="text-[11px] text-gray-400 font-medium truncate max-w-[200px] mt-0.5">{stock.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-200 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Info Summary */}
          {selectedStock && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${transactionType === 'BUY' ? 'bg-emerald-50/30 border-emerald-100/50' : 'bg-rose-50/30 border-rose-100/50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-bold text-gray-800 border border-gray-100">{selectedStock.symbol.charAt(0)}</div>
                <div>
                  <p className="font-bold text-black leading-tight">{selectedStock.symbol}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{selectedStock.description}</p>
                </div>
              </div>
              {transactionType === 'SELL' && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available</p>
                  <p className="font-bold text-black tabular-nums">{getAvailableShares(selectedStock.symbol).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {/* Currency Selector */}
          {selectedStock && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">Currency</label>
              <button
                type="button"
                onClick={() => setShowCurrencyPicker(v => !v)}
                className="w-full px-4 py-3 bg-gray-50 rounded-[18px] flex items-center justify-between hover:bg-gray-100 transition-colors active:scale-[0.99]"
              >
                <span className="text-[14px] font-bold text-black">
                  {getCurrencySymbol(txCurrency)}&nbsp;&nbsp;{txCurrency}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showCurrencyPicker ? 'rotate-180' : ''}`} />
              </button>
              <div className={`grid transition-all duration-200 ease-in-out ${showCurrencyPicker ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-2">
                    {CURRENCIES.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => { setTxCurrency(c.code); setShowCurrencyPicker(false); }}
                        className={`py-2.5 rounded-xl text-[12px] font-bold transition-all active:scale-95 flex flex-col items-center gap-0.5 ${
                          txCurrency === c.code
                            ? 'bg-black text-white'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>{getCurrencySymbol(c.code)}</span>
                        <span className="text-[10px] font-semibold opacity-70">{c.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Calendar Trigger */}
          <div className="space-y-2 relative" ref={calendarRef}>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 flex justify-between">
              <span>Trade Date</span>
              {isFetchingPrice && <span className="text-gray-400 flex items-center gap-1 normal-case tracking-normal font-medium"><Loader2 className="w-3 h-3 animate-spin" /> Fetching historical price...</span>}
            </label>
            <button 
              type="button" 
              onClick={() => setShowCalendar(!showCalendar)}
              className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-[18px] text-[14px] font-bold flex items-center justify-start relative hover:bg-gray-100 transition-colors"
            >
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              {format(new Date(purchaseDate), 'MMMM d, yyyy')}
            </button>

            {/* Floating Apple Calendar */}
            {showCalendar && (
              <div className="absolute z-[60] left-0 top-[100%] mt-2 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-[24px] shadow-[0_15px_50px_-10px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-top-2 duration-200">
                {renderCalendar()}
              </div>
            )}
          </div>

          {/* Inputs Grid: Shares & Unit Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">Shares</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input 
                  type="number" 
                  step="0.0001" 
                  value={shares} 
                  onChange={(e) => setShares(e.target.value)} 
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0.00" 
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-[18px] text-[15px] font-bold tabular-nums outline-none focus:ring-2 focus:ring-black/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                Unit Price
                <span className="text-gray-300">·</span>
                <span>{getCurrencySymbol(txCurrency)}</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input 
                  type="number" 
                  step="0.01" 
                  value={price} 
                  onChange={(e) => { setPrice(e.target.value); setPriceSource('manual'); }} 
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0.00" 
                  className={`w-full pl-11 pr-4 py-3.5 border-none rounded-[18px] text-[15px] font-bold tabular-nums outline-none focus:ring-2 focus:ring-black/5 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${priceSource === 'api' ? 'bg-blue-50/50 text-blue-900 ring-1 ring-blue-100' : 'bg-gray-50 text-black'}`} 
                />
              </div>
            </div>
          </div>

          {/* Fee & Optional Notes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                Fee (Optional)
                <span className="text-gray-300">·</span>
                <span>{getCurrencySymbol(txCurrency)}</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input 
                  type="number" 
                  step="0.01" 
                  value={fees} 
                  onChange={(e) => setFees(e.target.value)} 
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-[18px] text-[15px] font-bold outline-none focus:ring-2 focus:ring-black/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-[18px] text-[13px] font-medium outline-none focus:ring-2 focus:ring-black/5" />
            </div>
          </div>

          {/* Submission Feedback */}
          {submitStatus === 'success' && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-in slide-in-from-top-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-[14px] font-bold text-emerald-900">Recorded successfully!</p>
            </div>
          )}
          {submitStatus === 'error' && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3 animate-in shake-1 duration-300">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[13px] font-bold text-rose-900 leading-tight">{submitError}</p>
            </div>
          )}

          {/* CTA Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!selectedStock || !price || !shares || submitStatus !== 'idle'}
              className="w-full py-4 bg-black text-white text-[16px] font-bold rounded-[20px] shadow-lg shadow-black/10 hover:bg-gray-800 active:scale-[0.98] disabled:bg-gray-200 disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {submitStatus === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Confirm Transaction</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
