'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Search as SearchIcon, Loader2, Calendar as CalendarIcon, DollarSign, AlertCircle, CheckCircle, ChevronRight, Hash, ChevronLeft, ChevronDown } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import { useStock } from '@/hooks/useStock';
import { getCurrencySymbol } from '@/lib/currency';
import CachedAssetLogo from './CachedAssetLogo';

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

const inputBaseClass = 'w-full h-[50px] rounded-[18px] border-none outline-none focus:ring-2 focus:ring-black/5';
const filledInputClass = `${inputBaseClass} bg-element`;
const iconInputClass = `${filledInputClass} pl-11 pr-4 py-3.5`;
const numericInputClass = `${iconInputClass} text-[15px] font-bold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const plainTextInputClass = `${filledInputClass} px-4 py-3.5 text-[13px] font-medium`;
const inputTriggerClass = 'w-full h-[50px] rounded-[18px] bg-element hover:bg-element-hover transition-colors';
const errorInputClass = 'ring-2 ring-rose-200 bg-rose-50/70';
const errorLabelClass = 'text-rose-600';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioName: string;
  portfolioId: string;
  defaultTicker?: string;
  defaultTickerName?: string;
}

interface SearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

interface FormErrors {
  ticker?: string;
  shares?: string;
  price?: string;
}

interface RippleOrigin {
  x: number;
  y: number;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  portfolioName,
  portfolioId,
  defaultTicker,
  defaultTickerName,
}: AddTransactionModalProps) {
  const t = useTranslations('addTransaction');
  const locale = useLocale();
  const { searchStock, getQuote, getHistoricalPrice, isLoading } = useStock();
  const calendarRef = useRef<HTMLDivElement>(null);
  const tickerInputRef = useRef<HTMLInputElement>(null);
  const sharesInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const successTimeoutsRef = useRef<number[]>([]);
  const monthYearFormatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  });
  const fullDateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // 表单状态
  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL' | 'DIVIDEND'>('BUY');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);

  const txTypeRef = useRef(transactionType);
  txTypeRef.current = transactionType;

  // 货币与Logo
  const [txCurrency, setTxCurrency] = useState('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [txLogo, setTxLogo] = useState<string | null>(null);

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
  const [holdings, setHoldings] = useState<Array<{ ticker: string; name: string; quantity: number }>>([]);

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

      if (defaultTicker) {
        const ticker = defaultTicker.toUpperCase();
        const mockStock: SearchResult = {
          symbol: ticker,
          displaySymbol: ticker,
          description: defaultTickerName || ticker,
          type: t('commonStock'),
        };
        setSearchQuery(ticker);
        handleSelectStock(mockStock);
      }
    }
  }, [isOpen, fetchHoldings, defaultTicker]); // eslint-disable-line react-hooks/exhaustive-deps

  // 搜索股票逻辑
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 1 && !selectedStock) {
        const results = await searchStock(searchQuery);
        setSearchResults(results.slice(0, 8));
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchStock, selectedStock]);

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [successRippleOrigin, setSuccessRippleOrigin] = useState<RippleOrigin | null>(null);
  const [isClosingAfterSuccess, setIsClosingAfterSuccess] = useState(false);

  const clearScheduledSuccessTimeouts = useCallback(() => {
    successTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    successTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearScheduledSuccessTimeouts();
    };
  }, [clearScheduledSuccessTimeouts]);

  const handleReset = useCallback(() => {
    clearScheduledSuccessTimeouts();
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
    setTxLogo(null);
    setSubmitStatus('idle');
    setSubmitError('');
    setFieldErrors({});
    setSuccessRippleOrigin(null);
    setIsClosingAfterSuccess(false);
  }, [clearScheduledSuccessTimeouts]);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const clearFieldError = useCallback((field: keyof FormErrors) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      return { ...current, [field]: undefined };
    });
  }, []);

  const clearSubmissionError = useCallback(() => {
    if (submitStatus === 'error') {
      setSubmitStatus('idle');
      setSubmitError('');
    }
  }, [submitStatus]);

  const resolveSuccessRippleOrigin = useCallback((): RippleOrigin => {
    if (successRippleOrigin) {
      return successRippleOrigin;
    }

    const button = submitButtonRef.current;
    if (!button) {
      return { x: 0, y: 0 };
    }

    return {
      x: button.clientWidth / 2,
      y: button.clientHeight / 2,
    };
  }, [successRippleOrigin]);

  const queueSuccessClose = useCallback((afterClose?: () => void) => {
    clearScheduledSuccessTimeouts();
    setSubmitError('');
    setSubmitStatus('success');
    setSuccessRippleOrigin(resolveSuccessRippleOrigin());

    const exitTimeout = window.setTimeout(() => {
      setIsClosingAfterSuccess(true);
    }, 520);

    const finishTimeout = window.setTimeout(() => {
      handleClose();
      afterClose?.();
    }, 760);

    successTimeoutsRef.current = [exitTimeout, finishTimeout];
  }, [clearScheduledSuccessTimeouts, handleClose, resolveSuccessRippleOrigin]);

  const handleSelectStock = useCallback(async (stock: SearchResult) => {
    setSelectedStock(stock);
    setSearchQuery(stock.symbol);
    setIsSearchFocused(false);

    setIsFetchingPrice(true);
    const today = new Date().toISOString().split('T')[0];

    const pricePromise = (async () => {
      if (txTypeRef.current === 'DIVIDEND') return;

      if (purchaseDate && purchaseDate !== today) {
        const historical = await getHistoricalPrice(stock.symbol, purchaseDate);
        if (historical && historical.price > 0) {
          setPrice(historical.price.toFixed(2));
          clearFieldError('price');
          setPriceSource('api');
          return;
        }
      }

      const quote = await getQuote(stock.symbol);
      if (quote && quote.c > 0) {
        setPrice(quote.c.toFixed(2));
        clearFieldError('price');
        setPriceSource('api');
      }
    })();

    const currencyPromise = (async () => {
      const lookupRes = await fetch(`/api/assets/lookup?ticker=${encodeURIComponent(stock.symbol)}`);
      if (lookupRes.ok) {
        const data = await lookupRes.json();
        if (data.logo) setTxLogo(data.logo);
        if (data.currency && data.currency !== 'USD') { setTxCurrency(data.currency); return; }
      }

      const profileRes = await fetch(`/api/stock/profile?symbol=${encodeURIComponent(stock.symbol)}`);
      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.logo) setTxLogo(data.logo);
        if (data.currency) { setTxCurrency(data.currency); return; }
      }

      setTxCurrency(inferCurrencyFromTicker(stock.symbol));
    })();

    await Promise.all([pricePromise, currencyPromise]);
    setIsFetchingPrice(false);
  }, [clearFieldError, purchaseDate, getQuote, getHistoricalPrice]);

  const handleDateSelect = useCallback(async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setPurchaseDate(dateStr);
    setShowCalendar(false);

    if (selectedStock && txTypeRef.current !== 'DIVIDEND') {
      setIsFetchingPrice(true);
      const historical = await getHistoricalPrice(selectedStock.symbol, dateStr);
      if (historical && historical.price > 0) {
        setPrice(historical.price.toFixed(2));
        clearFieldError('price');
        setPriceSource('api');
      }
      setIsFetchingPrice(false);
    }
  }, [clearFieldError, selectedStock, getHistoricalPrice]);

  const focusField = useCallback((field: keyof FormErrors) => {
    if (field === 'ticker') tickerInputRef.current?.focus();
    if (field === 'shares') sharesInputRef.current?.focus();
    if (field === 'price') priceInputRef.current?.focus();
  }, []);

  const validateForm = useCallback(() => {
    const nextErrors: FormErrors = {};

    if (!selectedStock) {
      nextErrors.ticker = t('tickerRequired');
    }

    if (transactionType !== 'DIVIDEND') {
      const shareValue = parseFloat(shares);
      if (!shares.trim()) {
        nextErrors.shares = t('sharesRequired');
      } else if (!Number.isFinite(shareValue) || shareValue <= 0) {
        nextErrors.shares = t('sharesPositive');
      }
    }

    const priceValue = parseFloat(price);
    if (!price.trim()) {
      nextErrors.price = transactionType === 'DIVIDEND' ? t('payoutRequired') : t('unitPriceRequired');
    } else if (!Number.isFinite(priceValue) || priceValue <= 0) {
      nextErrors.price = transactionType === 'DIVIDEND' ? t('payoutPositive') : t('unitPricePositive');
    }

    setFieldErrors(nextErrors);
    const firstInvalidField = (['ticker', 'shares', 'price'] as Array<keyof FormErrors>).find((field) => nextErrors[field]);
    if (firstInvalidField) {
      focusField(firstInvalidField);
      return false;
    }

    return true;
  }, [focusField, price, selectedStock, shares, t, transactionType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearSubmissionError();

    if (!validateForm() || !selectedStock) {
      return;
    }

    if (transactionType === 'SELL') {
      const available = getAvailableShares(selectedStock.symbol);
      if (parseFloat(shares) > available) {
        setFieldErrors((current) => ({
          ...current,
          shares: t('insufficientShares', { available: available.toFixed(4) }),
        }));
        focusField('shares');
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
            quantity: transactionType === 'DIVIDEND' ? 1 : Math.abs(parseFloat(shares)),
            price: parseFloat(price),
            fee: transactionType === 'DIVIDEND' ? 0 : (parseFloat(fees) || 0),
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
        const localTxs = storedTransactions ? JSON.parse(storedTransactions) : [];
        localTxs.push(newTx);

        // 4. 保存回 localStorage
        localStorage.setItem('local_transactions', JSON.stringify(localTxs));

        // 5. 触发自定义事件，通知 DashboardClient 重新加载本地数据
        window.dispatchEvent(new Event('localTransactionsUpdated'));

        queueSuccessClose();
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

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          assetId,
          type: transactionType,
          quantity: transactionType === 'DIVIDEND' ? 1 : Math.abs(parseFloat(shares)),
          price: parseFloat(price),
          fee: transactionType === 'DIVIDEND' ? 0 : (parseFloat(fees) || 0),
          date: purchaseDate,
          notes: notes || null,
          currency: txCurrency,
        }),
      });

      if (!response.ok) throw new Error(t('submissionFailed'));
      queueSuccessClose(() => window.location.reload());
    } catch {
      setSubmitStatus('error');
      setSubmitError(t('recordFailed'));
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
    return (
      <div className="p-4 w-[300px] select-none">
        <div className="flex items-center justify-between mb-4 px-1">
          <button 
            type="button" 
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="text-[14px] font-bold text-primary hover:bg-element-hover px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
          >
            {monthYearFormatter.format(currentMonth)}
            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${showYearPicker ? 'rotate-90' : ''}`} />
          </button>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-element-hover rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-secondary" /></button>
            <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-element-hover rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-secondary" /></button>
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
                className={`py-3 text-[13px] font-semibold rounded-xl transition-all ${year === currentYear ? 'bg-primary text-on-primary' : 'hover:bg-element text-secondary'}`}
              >
                {year}
              </button>
            ))}
            <div className="col-span-3 flex justify-between mt-2 pt-2 border-t border-border">
              <button type="button" onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setFullYear(currentYear - 12);
                setCurrentMonth(newDate);
              }} className="p-1 hover:bg-element rounded text-secondary"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setFullYear(currentYear + 12);
                setCurrentMonth(newDate);
              }} className="p-1 hover:bg-element rounded text-secondary"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 mb-2">
              {[t('weekdays.sun'), t('weekdays.mon'), t('weekdays.tue'), t('weekdays.wed'), t('weekdays.thu'), t('weekdays.fri'), t('weekdays.sat')].map((d, i) => (
                <span key={i} className="text-center text-[10px] font-bold text-secondary">{d}</span>
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
                      ${isSelected ? 'bg-primary text-on-primary font-bold' : 'hover:bg-element text-gray-700'}
                      ${!isCurrentMonth ? 'opacity-20' : ''}
                    `}
                  >
                    {format(day, 'd')}
                    {isToday && !isSelected && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
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
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 backdrop-blur-md transition-all duration-300 p-4 ${isClosingAfterSuccess ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`relative w-full max-w-[500px] bg-card rounded-[28px] sm:rounded-[32px] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.15)] border border-border overflow-y-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 transition-all duration-300 ${isClosingAfterSuccess ? 'scale-[0.97] opacity-0 translate-y-2' : 'scale-100 opacity-100 translate-y-0'}`}>
        
        {/* Header - Apple Style */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8 pb-4 flex items-center justify-between sticky top-0 bg-card/90 backdrop-blur-sm z-20">
          <div>
            <h2 className="text-[20px] sm:text-[24px] font-bold text-primary tracking-tight leading-none">{t('title')}</h2>
            <p className="text-[12px] sm:text-[13px] text-secondary font-medium mt-1.5 sm:mt-2">{t('portfolio')}: <span className="text-primary font-semibold">{portfolioName}</span></p>
          </div>
          <button onClick={handleClose} className="p-2 text-secondary hover:text-primary transition-colors rounded-full hover:bg-element bg-element/50 sm:bg-transparent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-2 sm:p-8 sm:pt-2 space-y-5 sm:space-y-6">
          
          {/* Side Switch - Full Width Colorful Toggle */}
          <div className="bg-element-hover p-1.5 rounded-2xl relative h-12">
            <div className="absolute inset-0 p-1.5 flex transition-all duration-300 pointer-events-none">
              <div 
                className={`h-full w-1/3 rounded-xl shadow-sm transition-all duration-300 ease-out
                ${transactionType === 'BUY' ? 'bg-emerald-500 translate-x-0' : ''}
                ${transactionType === 'SELL' ? 'bg-rose-500 translate-x-full' : ''}
                ${transactionType === 'DIVIDEND' ? 'bg-indigo-500 translate-x-[200%]' : ''}`}
              />
            </div>
            <div className="flex h-full relative z-10">
              <button 
                type="button" 
                onClick={() => {
                  clearSubmissionError();
                  setFieldErrors({});
                  setTransactionType('BUY');
                  if (transactionType === 'DIVIDEND') setPrice('');
                }} 
                className={`flex-1 text-[14px] font-bold transition-colors duration-200 ${transactionType === 'BUY' ? 'text-on-primary' : 'text-secondary hover:text-secondary'}`}
              >{t('buy')}</button>
              <button 
                type="button" 
                onClick={() => {
                  clearSubmissionError();
                  setFieldErrors({});
                  setTransactionType('SELL');
                  if (transactionType === 'DIVIDEND') setPrice('');
                }} 
                className={`flex-1 text-[14px] font-bold transition-colors duration-200 ${transactionType === 'SELL' ? 'text-on-primary' : 'text-secondary hover:text-secondary'}`}
              >{t('sell')}</button>
              <button 
                type="button" 
                onClick={() => {
                  clearSubmissionError();
                  setFieldErrors({});
                  setTransactionType('DIVIDEND');
                  setPrice('');
                }} 
                className={`flex-1 text-[14px] font-bold transition-colors duration-200 ${transactionType === 'DIVIDEND' ? 'text-on-primary' : 'text-secondary hover:text-secondary'}`}
              >{t('dividend')}</button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative group">
            <label className={`text-[11px] font-bold uppercase tracking-widest mb-2 block px-1 ${fieldErrors.ticker ? errorLabelClass : 'text-secondary'}`}>{t('tickerLabel')}</label>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary group-focus-within:text-primary transition-colors" />
              <input
                ref={tickerInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onChange={(e) => {
                  clearSubmissionError();
                  clearFieldError('ticker');
                  setSearchQuery(e.target.value);
                  if (selectedStock) setSelectedStock(null);
                }}
                placeholder={t('tickerPlaceholder')}
                aria-invalid={!!fieldErrors.ticker}
                className={`w-full pl-11 pr-10 py-3.5 border-none rounded-[18px] text-[15px] font-semibold focus:ring-2 focus:ring-black/5 focus:bg-card transition-all outline-none ${fieldErrors.ticker ? errorInputClass : 'bg-element'}`}
                autoComplete="off"
              />
              {isLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-secondary" />}
            </div>
            {fieldErrors.ticker && (
              <p className="mt-2 px-1 text-[12px] font-medium text-rose-600">{fieldErrors.ticker}</p>
            )}

            {/* Suggestions & Quick Select */}
            {isSearchFocused && !selectedStock && (
              <div className="absolute z-50 w-full mt-2 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] max-h-60 overflow-y-auto p-2">
                
                {searchQuery === '' && holdings.length > 0 && (
                  <div className="mb-1 px-1 pt-1 pb-1">
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 px-2">{t('currentHoldings')}</p>
                    {holdings.map((h) => (
                      <button 
                        key={h.ticker} 
                        type="button" 
                        onClick={() => {
                          clearSubmissionError();
                          clearFieldError('ticker');
                          handleSelectStock({ symbol: h.ticker, displaySymbol: h.ticker, description: h.name, type: t('commonStock') });
                        }} 
                        className="w-full p-2 text-left hover:bg-element rounded-xl flex items-center justify-between group transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <span className="font-bold text-primary block truncate">{h.ticker}</span>
                          <p className="text-[11px] text-secondary font-medium truncate mt-0.5">{h.name}</p>
                        </div>
                        <div className="shrink-0">
                           <span className="inline-block text-[11px] font-bold text-secondary bg-element-hover/80 px-2 py-1 rounded-md whitespace-nowrap tabular-nums">
                             {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                           </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery !== '' && searchResults.length > 0 && searchResults.map((stock) => (
                  <button key={stock.symbol} type="button" onClick={() => {
                    clearSubmissionError();
                    clearFieldError('ticker');
                    handleSelectStock(stock);
                  }} className="w-full p-3 text-left hover:bg-element rounded-xl flex items-center justify-between group transition-colors">
                    <div>
                      <span className="font-bold text-primary">{stock.symbol}</span>
                      <p className="text-[11px] text-secondary font-medium truncate max-w-[200px] mt-0.5">{stock.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-200 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </button>
                ))}

                {searchQuery !== '' && searchResults.length === 0 && !isLoading && (
                  <div className="p-4 text-center text-secondary text-[13px] font-medium">{t('noResults', { query: searchQuery })}</div>
                )}
              </div>
            )}
          </div>

          {/* Selected Info Summary */}
          {selectedStock && (
            <div className="space-y-3">
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              transactionType === 'BUY' ? 'bg-emerald-50/30 border-emerald-100/50' : 
              transactionType === 'SELL' ? 'bg-rose-50/30 border-rose-100/50' :
              'bg-indigo-50/30 border-indigo-100/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-card shadow-sm flex items-center justify-center font-bold text-gray-800 border border-border overflow-hidden">
                  <CachedAssetLogo
                    ticker={selectedStock.symbol}
                    logoUrl={txLogo}
                    size={40}
                    loading="eager"
                    fallbackClassName="font-bold text-gray-800"
                  />
                </div>
                <div>
                  <p className="font-bold text-primary leading-tight">{selectedStock.symbol}</p>
                  <p className="text-[11px] text-secondary font-medium">{selectedStock.description}</p>
                </div>
              </div>
              {transactionType === 'SELL' && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">{t('available')}</p>
                  <p className="font-bold text-primary tabular-nums">{getAvailableShares(selectedStock.symbol).toLocaleString()}</p>
                </div>
              )}
              </div>
              
              {/* Warning for unowned Dividend */}
              {transactionType === 'DIVIDEND' && getAvailableShares(selectedStock.symbol) === 0 && (
                <div className="flex items-start gap-2.5 p-3 sm:px-4 bg-amber-50 rounded-xl border border-amber-100/60 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] font-semibold text-amber-700 leading-snug">{t('dividendWarning')}</p>
                </div>
              )}
            </div>
          )}

          {/* Currency Selector */}
          {selectedStock && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-secondary uppercase tracking-widest px-1">{t('currency')}</label>
              <button
                type="button"
                onClick={() => setShowCurrencyPicker(v => !v)}
                className={`${inputTriggerClass} px-4 flex items-center justify-between active:scale-[0.99]`}
              >
                <span className="text-[14px] font-bold text-primary">
                  {getCurrencySymbol(txCurrency)}&nbsp;&nbsp;{txCurrency}
                </span>
                <ChevronDown className={`w-4 h-4 text-secondary transition-transform duration-200 ${showCurrencyPicker ? 'rotate-180' : ''}`} />
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
                            ? 'bg-primary text-on-primary'
                            : 'bg-element text-gray-700 hover:bg-element-hover'
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
            <label className="text-[11px] font-bold text-secondary uppercase tracking-widest px-1 flex justify-between">
              <span>{t('tradeDate')}</span>
              {isFetchingPrice && <span className="text-secondary flex items-center gap-1 normal-case tracking-normal font-medium"><Loader2 className="w-3 h-3 animate-spin" /> {t('fetchingHistoricalPrice')}</span>}
            </label>
            <button 
              type="button" 
              onClick={() => setShowCalendar(!showCalendar)}
              className={`${inputTriggerClass} pl-11 pr-4 border-none text-[14px] font-bold flex items-center justify-start relative`}
            >
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
              {fullDateFormatter.format(new Date(purchaseDate))}
            </button>

            {/* Floating Apple Calendar */}
            {showCalendar && (
              <div className="absolute z-[60] left-0 top-[100%] mt-2 bg-card/95 backdrop-blur-xl border border-border rounded-[24px] shadow-[0_15px_50px_-10px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-top-2 duration-200">
                {renderCalendar()}
              </div>
            )}
          </div>

          <div className="space-y-5 sm:space-y-6 sm:min-h-[168px]">
            {/* Inputs Grid: Shares & Unit Price */}
            {transactionType !== 'DIVIDEND' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                <div className="space-y-2">
                  <label className={`text-[11px] font-bold uppercase tracking-widest px-1 ${fieldErrors.shares ? errorLabelClass : 'text-secondary'}`}>{t('shares')}</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input 
                      ref={sharesInputRef}
                      type="number" 
                      step="0.0001" 
                      value={shares} 
                      onChange={(e) => {
                        clearSubmissionError();
                        clearFieldError('shares');
                        setShares(e.target.value);
                      }} 
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="0.00" 
                      aria-invalid={!!fieldErrors.shares}
                      className={`${numericInputClass} ${fieldErrors.shares ? errorInputClass : ''}`}
                    />
                  </div>
                  {fieldErrors.shares && (
                    <p className="px-1 text-[12px] font-medium text-rose-600">{fieldErrors.shares}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className={`text-[11px] font-bold uppercase tracking-widest px-1 flex items-center gap-1.5 ${fieldErrors.price ? errorLabelClass : 'text-secondary'}`}>
                    {t('unitPrice')}
                    <span className="text-secondary">·</span>
                    <span>{getCurrencySymbol(txCurrency)}</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input 
                      ref={priceInputRef}
                      type="number" 
                      step="0.01" 
                      value={price} 
                      onChange={(e) => {
                        clearSubmissionError();
                        clearFieldError('price');
                        setPrice(e.target.value);
                        setPriceSource('manual');
                      }} 
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="0.00" 
                      aria-invalid={!!fieldErrors.price}
                      className={`${numericInputClass} transition-colors ${fieldErrors.price ? errorInputClass : (priceSource === 'api' ? 'bg-blue-50/50 text-blue-900 ring-1 ring-blue-100' : 'bg-element text-primary')}`}
                    />
                  </div>
                  {fieldErrors.price && (
                    <p className="px-1 text-[12px] font-medium text-rose-600">{fieldErrors.price}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <label className={`text-[11px] font-bold uppercase tracking-widest px-1 flex items-center gap-1.5 ${fieldErrors.price ? errorLabelClass : 'text-secondary'}`}>
                    {t('totalPayoutAmount')}
                    <span className="text-secondary">·</span>
                    <span>{getCurrencySymbol(txCurrency)}</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input 
                      ref={priceInputRef}
                      type="number" 
                      step="0.01" 
                      value={price} 
                      onChange={(e) => {
                        clearSubmissionError();
                        clearFieldError('price');
                        setPrice(e.target.value);
                        setPriceSource('manual');
                      }} 
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="0.00" 
                      aria-invalid={!!fieldErrors.price}
                      className={`${numericInputClass} transition-colors text-primary ${fieldErrors.price ? errorInputClass : ''}`}
                    />
                  </div>
                  {fieldErrors.price && (
                    <p className="px-1 text-[12px] font-medium text-rose-600">{fieldErrors.price}</p>
                  )}
                </div>
              </div>
            )}

            {/* Fee & Optional Notes Grid */}
            <div className={`grid grid-cols-1 gap-5 sm:gap-6 ${transactionType !== 'DIVIDEND' ? 'sm:grid-cols-2' : ''}`}>
              {transactionType !== 'DIVIDEND' ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-secondary uppercase tracking-widest px-1 flex items-center gap-1.5">
                    {t('feeOptional')}
                    <span className="text-secondary">·</span>
                    <span>{getCurrencySymbol(txCurrency)}</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input 
                      type="number" 
                      step="0.01" 
                      value={fees} 
                      onChange={(e) => setFees(e.target.value)} 
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className={numericInputClass}
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-secondary uppercase tracking-widest px-1">{t('notes')}</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('optional')} className={plainTextInputClass} />
              </div>
            </div>
          </div>

          {submitStatus === 'error' && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3 animate-in shake-1 duration-300">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[13px] font-bold text-rose-900 leading-tight">{submitError}</p>
            </div>
          )}

          {/* CTA Button */}
          <div className="pt-2">
            <button
              ref={submitButtonRef}
              type="submit"
              onPointerDown={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setSuccessRippleOrigin({
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top,
                });
              }}
              disabled={submitStatus === 'loading' || submitStatus === 'success'}
              className={`relative w-full py-4 text-[16px] font-bold rounded-[20px] shadow-lg shadow-black/10 transition-all flex items-center justify-center gap-2 overflow-hidden disabled:shadow-none ${
                submitStatus === 'success'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98] disabled:bg-gray-200'
              }`}
            >
              {submitStatus === 'success' && successRippleOrigin && (
                <span
                  className="pointer-events-none absolute rounded-full bg-emerald-400/70 transition-transform duration-500 ease-out scale-[20] sm:scale-[24]"
                  style={{
                    left: successRippleOrigin.x,
                    top: successRippleOrigin.y,
                    width: 14,
                    height: 14,
                    transform: 'translate(-50%, -50%) scale(1)',
                  }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2">
                {submitStatus === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : submitStatus === 'success' ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>{t('success')}</span>
                  </>
                ) : (
                  <span>{t('confirm')}</span>
                )}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
