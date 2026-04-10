'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCurrencySymbol, convertAmount, formatCurrency, USD_RATES } from './currency';

type IdleCallbackHandle = number | ReturnType<typeof globalThis.setTimeout>;

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  lastUpdated: string;
}

interface UseCurrencyReturn {
  baseCurrency: string;
  rates: Record<string, number>;
  symbol: string;
  convert: (usdAmount: number) => number;
  fmt: (usdAmount: number) => string;
  isLoading: boolean;
}

const CACHE_KEY = 'exchange_rates';
const CACHE_UPDATED_KEY = 'exchange_rates_updated_at';
const CACHE_BASE_KEY = 'exchange_rates_base';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function scheduleIdleRefresh(callback: () => void, timeout = 1500): IdleCallbackHandle {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(() => callback(), { timeout });
  }
  return globalThis.setTimeout(callback, timeout);
}

function cancelIdleRefresh(handle: IdleCallbackHandle) {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(Number(handle));
    return;
  }
  globalThis.clearTimeout(handle);
}

export function useCurrency(): UseCurrencyReturn {
  const [baseCurrency, setBaseCurrency] = useState<string>('USD');
  const [rates, setRates] = useState<Record<string, number>>(USD_RATES);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      // Always fetch USD-based rates, ignore the currency parameter
      const res = await fetch(`/api/exchange-rates?base=USD`);
      if (!res.ok) return;
      const data: ExchangeRates = await res.json();
      setRates(data.rates);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.rates));
      localStorage.setItem(CACHE_UPDATED_KEY, data.lastUpdated);
      localStorage.setItem(CACHE_BASE_KEY, 'USD');
    } catch {
      // silently fail, keep using cached rates
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const currency = localStorage.getItem('base_currency') || 'USD';
    setBaseCurrency(currency);
    let refreshHandle: IdleCallbackHandle | null = null;

    // Load cached rates immediately
    const cachedBase = localStorage.getItem(CACHE_BASE_KEY);
    const cachedRates = localStorage.getItem(CACHE_KEY);
    const cachedUpdatedAt = localStorage.getItem(CACHE_UPDATED_KEY);

    const cacheValid =
      cachedRates &&
      cachedBase === 'USD' &&  // Cache must be USD-based
      cachedUpdatedAt &&
      Date.now() - new Date(cachedUpdatedAt).getTime() < CACHE_TTL_MS;

    if (cacheValid) {
      setRates(JSON.parse(cachedRates!));
      // Refresh in browser idle time so hydration/UI work wins first
      refreshHandle = scheduleIdleRefresh(() => { void fetchRates(); }, 3000);
    } else {
      setIsLoading(true);
      void fetchRates();
    }

    return () => {
      if (refreshHandle != null) {
        cancelIdleRefresh(refreshHandle);
      }
    };
  }, [fetchRates]);

  // Re-fetch when base_currency changes (e.g. user updates in Settings)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'base_currency' && e.newValue && e.newValue !== baseCurrency) {
        setBaseCurrency(e.newValue);
        setIsLoading(true);
        fetchRates();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [baseCurrency, fetchRates]);

  const convert = useCallback(
    (usdAmount: number) => convertAmount(usdAmount, rates, baseCurrency),
    [rates, baseCurrency]
  );

  const fmt = useCallback(
    (usdAmount: number) => formatCurrency(usdAmount, baseCurrency, rates),
    [rates, baseCurrency]
  );

  return {
    baseCurrency,
    rates,
    symbol: getCurrencySymbol(baseCurrency),
    convert,
    fmt,
    isLoading,
  };
}
