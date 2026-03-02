'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, Globe, ChevronDown } from 'lucide-react';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  lastUpdated: string;
  isFallback?: boolean;
}

interface CurrencySelectorProps {
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  className?: string;
}

const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: '$' },
];

export default function CurrencySelector({
  selectedCurrency,
  onCurrencyChange,
  className = '',
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedCurrencyInfo = COMMON_CURRENCIES.find(c => c.code === selectedCurrency) || COMMON_CURRENCIES[0];

  const fetchExchangeRates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/exchange-rates?base=${selectedCurrency}`);
      if (response.ok) {
        const data = await response.json();
        setExchangeRates(data);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRates();
    // 每5分钟自动刷新汇率
    const interval = setInterval(fetchExchangeRates, 300000);
    return () => clearInterval(interval);
  }, [selectedCurrency]);

  const handleCurrencySelect = (currencyCode: string) => {
    onCurrencyChange(currencyCode);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Globe className="w-4 h-4 text-gray-500" />
        <span className="font-medium text-gray-900">
          {selectedCurrencyInfo.code} {selectedCurrencyInfo.symbol}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Select Currency</h3>
                <button
                  onClick={fetchExchangeRates}
                  disabled={isLoading}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  title="Refresh exchange rates"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {exchangeRates && (
                <p className="text-xs text-gray-500 mt-1">
                  Rates updated: {new Date(exchangeRates.lastUpdated).toLocaleTimeString()}
                  {exchangeRates.isFallback && ' (estimated)'}
                </p>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {COMMON_CURRENCIES.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => handleCurrencySelect(currency.code)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    selectedCurrency === currency.code
                      ? 'bg-gray-100 text-gray-900'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">{currency.code}</span>
                    <span className="text-gray-500 text-sm">{currency.name}</span>
                  </div>
                  <span className="text-gray-400">{currency.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}