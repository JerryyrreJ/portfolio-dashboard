'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Search, Loader2, TrendingUp, TrendingDown, Calendar, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { useStock } from '@/hooks/useStock';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioName: string;
  portfolioId: number;
}

interface SearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

// 资产类型映射到数据库中的 ID
const ASSET_ID_MAP: Record<string, number> = {
  'AMD': 1,
  'GOOG': 2,
  'EWY': 3,
  'XIACY': 4,
};

export default function AddTransactionModal({
  isOpen,
  onClose,
  portfolioName,
  portfolioId
}: AddTransactionModalProps) {
  const { searchStock, getQuote, getHistoricalPrice, isLoading } = useStock();

  // 表单状态
  const [assetType, setAssetType] = useState<'stock' | 'crypto' | 'other'>('stock');
  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY');
  const [symbol, setSymbol] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);

  // 价格和日期
  const [purchaseDate, setPurchaseDate] = useState('');
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [fees, setFees] = useState('0');
  const [notes, setNotes] = useState('');

  // 自动价格获取状态
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceSource, setPriceSource] = useState<'api' | 'manual'>('manual');

  // 持仓检查状态
  const [holdings, setHoldings] = useState<Array<{
    assetId: string;
    ticker: string;
    name: string;
    market: string;
    quantity: number;
    avgCost: number;
    totalCost: number;
  }>>([]);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(false);
  const [holdingsError, setHoldingsError] = useState('');

  // 获取持仓数据
  const fetchHoldings = useCallback(async () => {
    if (!portfolioId) return;

    setIsLoadingHoldings(true);
    setHoldingsError('');

    try {
      const response = await fetch(`/api/holdings?portfolioId=${portfolioId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch holdings');
      }
      const data = await response.json();
      setHoldings(data.holdings || []);
    } catch (error) {
      console.error('Error fetching holdings:', error);
      setHoldingsError('Failed to load holdings data');
    } finally {
      setIsLoadingHoldings(false);
    }
  }, [portfolioId]);

  // 获取当前股票的可卖出数量
  const getAvailableShares = useCallback((ticker: string): number => {
    const holding = holdings.find(h => h.ticker === ticker);
    return holding ? holding.quantity : 0;
  }, [holdings]);

  // 当打开弹窗时，获取持仓数据
  useEffect(() => {
    if (isOpen) {
      fetchHoldings();
    }
  }, [isOpen, fetchHoldings]);

  // 搜索股票（防抖）
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 1 && !selectedStock) {
        const results = await searchStock(searchQuery);
        setSearchResults(results.slice(0, 10));
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchStock, selectedStock]);

  // 当选择股票后，自动获取实时价格作为参考
  const handleSelectStock = useCallback(async (stock: SearchResult) => {
    setSelectedStock(stock);
    setSymbol(stock.symbol);
    setSearchQuery(`${stock.symbol} - ${stock.description}`);
    setShowSearchResults(false);

    // 获取实时价格作为参考
    setIsFetchingPrice(true);
    const quote = await getQuote(stock.symbol);
    if (quote && quote.c > 0) {
      if (!price) {
        setPrice(quote.c.toFixed(2));
        setPriceSource('api');
      }
    }
    setIsFetchingPrice(false);
  }, [getQuote, price]);

  // 当选择日期后，自动获取该日期的收盘价
  const handleDateChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setPurchaseDate(date);

    if (selectedStock && date) {
      setIsFetchingPrice(true);
      const historical = await getHistoricalPrice(selectedStock.symbol, date);
      if (historical && historical.price > 0) {
        setPrice(historical.price.toFixed(2));
        setPriceSource('api');
      } else {
        const quote = await getQuote(selectedStock.symbol);
        if (quote && quote.c > 0) {
          console.warn('Historical price not available, using current price as reference');
        }
      }
      setIsFetchingPrice(false);
    }
  }, [selectedStock, getHistoricalPrice, getQuote]);

  // 重置表单
  const handleReset = () => {
    setSymbol('');
    setSearchQuery('');
    setSelectedStock(null);
    setSearchResults([]);
    setPurchaseDate('');
    setPrice('');
    setShares('');
    setFees('0');
    setNotes('');
    setPriceSource('manual');
    setTransactionType('BUY');
    setHoldingsError('');
  };

  // 关闭弹窗并重置
  const handleClose = () => {
    handleReset();
    setTransactionType('BUY');
    setHoldings([]);
    setHoldingsError('');
    onClose();
  };

  // 提交状态
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string>('');

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStock) return;

    // 卖出交易检查
    if (transactionType === 'SELL') {
      const availableShares = getAvailableShares(selectedStock.symbol);
      const sellQuantity = parseFloat(shares);

      if (sellQuantity > availableShares) {
        setSubmitStatus('error');
        setSubmitError(`Cannot sell ${sellQuantity} shares. You only have ${availableShares.toFixed(4)} shares available.`);
        return;
      }

      if (availableShares <= 0) {
        setSubmitStatus('error');
        setSubmitError(`You don't have any shares of ${selectedStock.symbol} to sell.`);
        return;
      }
    }

    setSubmitStatus('loading');
    setSubmitError('');

    try {
      // 查找资产 ID（从数据库中获取）
      const ticker = selectedStock.symbol;

      // 首先尝试从 API 查找资产
      const assetLookupRes = await fetch(`/api/assets/lookup?ticker=${encodeURIComponent(ticker)}`);
      let assetId: number;

      if (assetLookupRes.ok) {
        const assetData = await assetLookupRes.json();
        assetId = assetData.id;
      } else {
        // 如果资产不存在，创建新资产
        const createAssetRes = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: selectedStock.symbol,
            name: selectedStock.description,
            market: 'US',
          }),
        });

        if (!createAssetRes.ok) {
          const errorData = await createAssetRes.json().catch(() => ({}));
          console.error('Create asset failed:', errorData);
          throw new Error(errorData.details || errorData.error || 'Failed to create asset');
        }

        const newAsset = await createAssetRes.json();
        assetId = newAsset.id;
      }

      // 创建交易记录
      const transactionData = {
        portfolioId: portfolioId,
        assetId: assetId,
        type: transactionType,
        quantity: transactionType === 'SELL' ? -Math.abs(parseFloat(shares)) : parseFloat(shares),
        price: parseFloat(price),
        fee: parseFloat(fees) || 0,
        date: purchaseDate,
        notes: notes || null,
      };

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create transaction');
      }

      setSubmitStatus('success');

      // 成功后关闭弹窗并刷新页面
      setTimeout(() => {
        handleClose();
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Failed to submit transaction:', error);
      setSubmitStatus('error');
      setSubmitError(error instanceof Error ? error.message : 'Failed to create transaction');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Trade</h2>
            <p className="text-sm text-gray-500">{portfolioName}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 transition-colors rounded-lg hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Asset Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asset Type
            </label>
            <div className="flex gap-2">
              {(['stock', 'crypto', 'other'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAssetType(type)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                    assetType === type
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTransactionType('BUY')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  transactionType === 'BUY'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Buy
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('SELL')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  transactionType === 'SELL'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Sell
              </button>
            </div>
          </div>

          {/* Stock Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Stock
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedStock && e.target.value !== `${selectedStock.symbol} - ${selectedStock.description}`) {
                    setSelectedStock(null);
                    setSymbol('');
                  }
                }}
                placeholder="Search by symbol or company name..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                disabled={isLoading}
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((stock) => (
                  <button
                    key={stock.symbol}
                    type="button"
                    onClick={() => handleSelectStock(stock)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">{stock.symbol}</span>
                        <span className="ml-2 text-sm text-gray-500">{stock.displaySymbol}</span>
                      </div>
                      <span className="text-xs text-gray-400 uppercase">{stock.type}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">{stock.description}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Stock Info */}
            {selectedStock && (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-900">{selectedStock.symbol}</span>
                    <p className="text-sm text-gray-600">{selectedStock.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStock(null);
                      setSymbol('');
                      setSearchQuery('');
                      setPrice('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Purchase Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Purchase Date
              </span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={handleDateChange}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
            />
            {isFetchingPrice && (
              <p className="mt-1 text-sm text-gray-600 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching historical price for this date...
              </p>
            )}
          </div>

          {/* Price and Shares */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Price per Share
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setPriceSource('manual');
                  }}
                  required
                  className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
              {priceSource === 'api' && price && (
                <p className="mt-1 text-xs text-green-700 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Auto-filled from market data
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shares
                {transactionType === 'SELL' && selectedStock && (
                  <span className="ml-2 text-xs text-gray-500">
                    (Available: {getAvailableShares(selectedStock.symbol).toFixed(4)})
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
              />
              {transactionType === 'SELL' && selectedStock && getAvailableShares(selectedStock.symbol) <= 0 && (
                <p className="mt-1 text-xs text-red-600">
                  No shares available to sell for this stock
                </p>
              )}
            </div>
          </div>

          {/* Total Preview */}
          {price && shares && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {transactionType === 'BUY' ? 'Total Cost:' : 'Total Proceeds:'}
                </span>
                <span className={`text-lg font-semibold ${transactionType === 'BUY' ? 'text-gray-900' : 'text-green-700'}`}>
                  ${(parseFloat(price) * parseFloat(shares)).toFixed(2)}
                </span>
              </div>
              {fees && parseFloat(fees) > 0 && (
                <div className="flex justify-between items-center mt-1 text-sm">
                  <span className="text-gray-500">Fees:</span>
                  <span className="text-gray-600">${parseFloat(fees).toFixed(2)}</span>
                </div>
              )}
              {transactionType === 'SELL' && selectedStock && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Available to Sell:</span>
                    <span className={`font-medium ${getAvailableShares(selectedStock.symbol) < parseFloat(shares || '0') ? 'text-red-600' : 'text-gray-900'}`}>
                      {getAvailableShares(selectedStock.symbol).toFixed(4)} shares
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fees and Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fees (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="^[0-9]*\.?[0-9]*$"
                  value={fees}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                      setFees(value);
                    }
                  }}
                  className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Dividend reinvestment"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
              />
            </div>
          </div>

          {/* Status Messages */}
          {submitStatus === 'success' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Transaction created successfully!</p>
                <p className="text-sm text-green-700">Refreshing page...</p>
              </div>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Failed to create transaction</p>
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitStatus === 'loading'}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedStock || !price || !shares || !purchaseDate || isLoading || submitStatus === 'loading' || submitStatus === 'success' || (transactionType === 'SELL' && getAvailableShares(selectedStock.symbol) <= 0)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitStatus === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : submitStatus === 'success' ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Saved!
                </span>
              ) : (
                'Add Trade'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
