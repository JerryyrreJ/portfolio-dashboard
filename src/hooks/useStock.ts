'use client';

import { useState, useCallback } from 'react';

export interface StockQuote {
  c: number; // 当前价格
  d: number; // 价格变动
  dp: number; // 价格变动百分比
  h: number; // 当日最高
  l: number; // 当日最低
  o: number; // 当日开盘
  pc: number; // 昨日收盘
  t: number; // 时间戳
}

export interface StockSearchResult {
  count: number;
  result: Array<{
    description: string;
    displaySymbol: string;
    symbol: string;
    type: string;
  }>;
}

export interface HistoricalPrice {
  symbol: string;
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  timestamp: number;
}

export function useStock() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取股票实时报价
  const getQuote = useCallback(async (symbol: string): Promise<StockQuote | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stock/quote?symbol=${encodeURIComponent(symbol)}`);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch quote');
      }

      const data: StockQuote = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 搜索股票
  const searchStock = useCallback(async (query: string): Promise<StockSearchResult['result']> => {
    if (!query || query.length < 1) return [];

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to search stocks');
      }

      const data: StockSearchResult = await response.json();
      return data.result || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 获取历史价格
  const getHistoricalPrice = useCallback(async (
    symbol: string,
    date: string
  ): Promise<HistoricalPrice | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stock/historical?symbol=${encodeURIComponent(symbol)}&date=${date}`
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch historical price');
      }

      const data: HistoricalPrice = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 批量获取报价（并发）
  const getBatchQuotes = useCallback(async (symbols: string[]): Promise<Record<string, StockQuote>> => {
    const results: Record<string, StockQuote> = {};

    // 并发请求，但限制并发数避免过载
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(async (symbol) => {
        const quote = await getQuote(symbol);
        if (quote) {
          results[symbol] = quote;
        }
      });
      await Promise.all(promises);
    }

    return results;
  }, [getQuote]);

  return {
    isLoading,
    error,
    getQuote,
    searchStock,
    getHistoricalPrice,
    getBatchQuotes,
  };
}
