'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Calendar, RefreshCw, Info, MinusCircle, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrencySymbol } from '@/lib/currency';
import CachedAssetLogo from './CachedAssetLogo';

interface PendingDividend {
  id: string;
  ticker: string;
  name: string;
  logo?: string | null;
  exDate: Date;
  payDate?: Date | null;
  sharesHeld: number;
  dividendPerShare: number;
  calculatedAmount: number;
  currency: string;
  assetCurrency?: string | null;
  status: string;
}

interface DividendConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  onConfirmed?: () => void;
}

export default function DividendConfirmationModal({
  isOpen,
  onClose,
  portfolioId,
  onConfirmed,
}: DividendConfirmationModalProps) {
  const [pendingDividends, setPendingDividends] = useState<PendingDividend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedAmounts, setEditedAmounts] = useState<Record<string, number>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [reinvestingId, setReinvestingId] = useState<string | null>(null);
  const [reinvestPrices, setReinvestPrices] = useState<Record<string, string>>({});
  const [reinvestDates, setReinvestDates] = useState<Record<string, string>>({});

  const getDefaultReinvestDate = useCallback((dividend: PendingDividend) => {
    const baseDate = dividend.payDate ? new Date(dividend.payDate) : new Date(dividend.exDate);
    return format(baseDate, 'yyyy-MM-dd');
  }, []);

  const fetchPendingDividends = useCallback(async () => {
    if (!portfolioId || portfolioId === 'local-portfolio') return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/dividends/pending?portfolioId=${portfolioId}`);
      if (!response.ok) throw new Error('Failed to fetch dividends');
      const data: { dividends?: PendingDividend[] } = await response.json();
      setPendingDividends(data.dividends || []);
    } catch {
      setError('Unable to load pending dividends');
    } finally {
      setIsLoading(false);
    }
  }, [portfolioId]);

  const handleSync = async () => {
    if (!portfolioId || portfolioId === 'local-portfolio') return;
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch('/api/transactions/dividends/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId, force: true }),
      });
      if (!response.ok) throw new Error('Sync failed');
      setEditedAmounts({});
      setEditingId(null);
      setReinvestingId(null);
      await fetchPendingDividends();
    } catch {
      setError('Sync failed. Please try again later.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirm = async (
    dividendId: string,
    options?: { mode?: 'cash' | 'reinvest'; reinvestPrice?: number; reinvestDate?: string }
  ) => {
    setProcessingIds(prev => new Set(prev).add(dividendId));
    try {
      const finalAmount = editedAmounts[dividendId];
      const mode = options?.mode || 'cash';
      const response = await fetch('/api/transactions/dividends/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dividendId,
          mode,
          ...(finalAmount !== undefined && { finalAmount }),
          ...(options?.reinvestPrice !== undefined && { reinvestPrice: options.reinvestPrice }),
          ...(options?.reinvestDate && { reinvestDate: options.reinvestDate }),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || 'Confirmation failed');
      }
      setPendingDividends(prev => prev.filter(d => d.id !== dividendId));
      setReinvestingId(prev => prev === dividendId ? null : prev);
      if (onConfirmed) onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(dividendId);
        return next;
      });
    }
  };

  const handleIgnore = async (dividendId: string) => {
    setProcessingIds(prev => new Set(prev).add(dividendId));
    try {
      await fetch('/api/transactions/dividends/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dividendId }),
      });
      setPendingDividends(prev => prev.filter(d => d.id !== dividendId));
      setReinvestingId(prev => prev === dividendId ? null : prev);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(dividendId);
        return next;
      });
    }
  };

  const toggleReinvest = (dividend: PendingDividend) => {
    setError(null);
    setReinvestingId((current) => {
      if (current === dividend.id) return null;
      setReinvestDates((prev) => (
        prev[dividend.id]
          ? prev
          : { ...prev, [dividend.id]: getDefaultReinvestDate(dividend) }
      ));
      return dividend.id;
    });
  };

  const handleConfirmReinvestment = async (dividend: PendingDividend) => {
    const priceRaw = reinvestPrices[dividend.id] ?? '';
    const reinvestPrice = Number(priceRaw);
    const reinvestDate = reinvestDates[dividend.id] || getDefaultReinvestDate(dividend);

    if (!Number.isFinite(reinvestPrice) || reinvestPrice <= 0) {
      setError(`Enter a valid reinvestment price for ${dividend.ticker}`);
      return;
    }

    await handleConfirm(dividend.id, {
      mode: 'reinvest',
      reinvestPrice,
      reinvestDate,
    });
  };

  useEffect(() => {
    if (isOpen) fetchPendingDividends();
  }, [isOpen, fetchPendingDividends]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose} />

      <div className="relative w-full max-w-[840px] bg-card rounded-[28px] sm:rounded-[32px] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.5)] border border-border/50 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-500 ease-out-expo">
        
        {/* Header */}
        <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-6 sm:pb-8 flex items-center justify-between">
          <div className="min-w-0 pr-4">
            <h2 className="text-[24px] sm:text-[28px] font-bold text-primary tracking-tight leading-tight truncate">Review Dividends</h2>
            <p className="text-[13px] sm:text-[14px] text-secondary font-medium opacity-60">Record your expected payouts</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-3 sm:px-4 py-2 bg-element hover:bg-element-hover rounded-xl text-primary text-[12px] sm:text-[13px] font-bold transition-all active:scale-95 border border-border/40 flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">Sync</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 sm:p-3 text-secondary hover:text-primary transition-all rounded-full bg-element/50 hover:bg-element active:scale-90"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-10 space-y-4">
          {error && (
            <div className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <p className="text-[13px] font-bold text-rose-500">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-12 h-12 animate-spin text-primary/10" />
            </div>
          ) : pendingDividends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-element flex items-center justify-center mb-6 sm:mb-8 border border-border/50 shadow-inner">
                <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-primary opacity-20" />
              </div>
              <h3 className="text-[18px] sm:text-[20px] font-bold text-primary tracking-tight">You&apos;re all set</h3>
              <p className="text-[14px] sm:text-[15px] text-secondary font-medium mt-2 opacity-50">No pending dividends to review at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDividends.map((dividend, index) => {
                const isEditing = editingId === dividend.id;
                const isProcessing = processingIds.has(dividend.id);
                const isReinvesting = reinvestingId === dividend.id;
                const displayAmount = editedAmounts[dividend.id] ?? dividend.calculatedAmount;
                const payoutCurrencySymbol = getCurrencySymbol(dividend.currency);
                const reinvestCurrency = dividend.assetCurrency || dividend.currency;
                const reinvestCurrencySymbol = getCurrencySymbol(reinvestCurrency);
                const isFuture = dividend.payDate && new Date(dividend.payDate) > new Date();
                const reinvestPriceValue = reinvestPrices[dividend.id] ?? '';
                const reinvestPrice = Number(reinvestPriceValue);
                const estimatedShares = Number.isFinite(reinvestPrice) && reinvestPrice > 0
                  ? displayAmount / reinvestPrice
                  : null;

                return (
                  <div
                    key={dividend.id}
                    className="group bg-element/20 dark:bg-element/10 hover:bg-element/40 dark:hover:bg-element/20 rounded-[24px] border border-border/30 hover:border-border transition-all duration-500 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 ease-out-expo"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8">
                      
                      {/* Asset & Stats */}
                      <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-card shadow-xl shadow-black/5 flex items-center justify-center border border-border overflow-hidden shrink-0 transition-transform duration-500 group-hover:scale-110">
                          <CachedAssetLogo
                            ticker={dividend.ticker}
                            logoUrl={dividend.logo}
                            size={64}
                            loading="lazy"
                            fallbackClassName="font-bold text-lg sm:text-xl"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 sm:mb-1.5">
                            <span className="text-[18px] sm:text-[20px] font-bold text-primary tracking-tight leading-none truncate">{dividend.ticker}</span>
                            <span className="px-1.5 py-0.5 bg-element rounded-md text-[9px] sm:text-[10px] font-bold text-secondary uppercase tracking-widest shrink-0">{dividend.status}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 sm:w-4 h-4 text-secondary opacity-40" />
                              <span className="text-[12px] sm:text-[14px] font-medium text-secondary">{format(new Date(dividend.exDate), 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] sm:text-[14px] font-medium text-secondary opacity-40">Holdings:</span>
                              <span className="text-[12px] sm:text-[14px] font-bold text-primary tabular-nums">{dividend.sharesHeld.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right/Bottom: Amount & Action */}
                      <div className="flex flex-row lg:flex-row items-center justify-between lg:justify-end gap-4 sm:gap-8 mt-2 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-none border-border/20">
                        
                        {/* Amount Section */}
                        <div 
                          onClick={() => !isEditing && setEditingId(dividend.id)}
                          className="flex flex-col items-start lg:items-end cursor-pointer group/amt"
                        >
                          <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.15em] mb-0.5 opacity-50">Estimated</p>
                          {isEditing ? (
                            <div className="flex items-center bg-card border border-primary rounded-xl px-2 py-0.5 ring-4 ring-primary/5 shadow-inner">
                              <span className="text-[18px] font-bold text-primary mr-1">{payoutCurrencySymbol}</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={displayAmount}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^\d*\.?\d*$/.test(val)) {
                                    setEditedAmounts(prev => ({ ...prev, [dividend.id]: parseFloat(val) || 0 }));
                                  }
                                }}
                                onWheel={(e) => e.currentTarget.blur()}
                                onBlur={() => !isProcessing && setEditingId(null)}
                                className="w-20 sm:w-24 bg-transparent border-none p-0 text-[18px] sm:text-[22px] font-bold text-primary tabular-nums focus:ring-0 text-right"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 sm:gap-2 lg:group-hover/amt:translate-x-[-4px] transition-transform duration-300">
                              <div className="hidden lg:flex w-7 h-7 rounded-lg bg-element/50 items-center justify-center opacity-0 group-hover/amt:opacity-100 transition-opacity">
                                <Pencil className="w-3.5 h-3.5 text-secondary" />
                              </div>
                              <span className="text-[22px] sm:text-[26px] font-bold text-primary tracking-tight tabular-nums leading-none">
                                {payoutCurrencySymbol}{displayAmount.toFixed(2)}
                              </span>
                              <Pencil className="lg:hidden w-3.5 h-3.5 text-secondary opacity-40" />
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button
                            onClick={() => handleIgnore(dividend.id)}
                            disabled={isProcessing}
                            className="p-3 sm:p-3.5 text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"
                            title="Ignore"
                          >
                            <MinusCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => toggleReinvest(dividend)}
                            disabled={isProcessing}
                            className={`h-10 sm:h-12 px-4 sm:px-5 text-[12px] sm:text-[13px] font-bold rounded-xl transition-all border ${
                              isReinvesting
                                ? 'bg-element text-primary border-border'
                                : 'bg-card text-secondary border-border hover:bg-element-hover'
                            } disabled:opacity-50`}
                          >
                            {isReinvesting ? 'Hide Reinvest' : 'Reinvest'}
                          </button>
                          <button
                            onClick={() => handleConfirm(dividend.id)}
                            disabled={isProcessing}
                            className="h-10 sm:h-12 px-5 sm:px-8 bg-primary text-on-primary text-[13px] sm:text-[14px] font-bold rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : 'Confirm Cash'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {isReinvesting && (
                      <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-border/20">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 sm:gap-4 items-end">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                              Reinvestment price per share ({reinvestCurrency})
                            </label>
                            <div className="flex items-center bg-card border border-border rounded-xl px-3 h-11">
                              <span className="text-[14px] font-bold text-primary mr-2">{reinvestCurrencySymbol}</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={reinvestPriceValue}
                                onChange={(e) => setReinvestPrices((prev) => ({ ...prev, [dividend.id]: e.target.value }))}
                                className="w-full bg-transparent border-none p-0 text-[14px] font-semibold text-primary focus:ring-0 outline-none"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                              Reinvestment date
                            </label>
                            <input
                              type="date"
                              value={reinvestDates[dividend.id] ?? getDefaultReinvestDate(dividend)}
                              onChange={(e) => setReinvestDates((prev) => ({ ...prev, [dividend.id]: e.target.value }))}
                              className="h-11 w-full px-3 bg-card rounded-xl text-[13px] font-semibold border border-border focus:border-primary outline-none transition-all"
                            />
                          </div>
                          <button
                            onClick={() => handleConfirmReinvestment(dividend)}
                            disabled={isProcessing}
                            className="h-11 px-5 bg-primary text-on-primary text-[13px] font-bold rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Reinvestment'}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-medium text-secondary">
                          <span className="px-2 py-1 rounded-lg bg-element text-primary font-bold">
                            Estimated shares: {estimatedShares != null ? estimatedShares.toFixed(6) : '—'}
                          </span>
                          <span>
                            Folio will record this as one dividend and one DRIP buy.
                          </span>
                        </div>
                      </div>
                    )}

                    {isFuture && (
                      <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-border/20 flex items-center gap-2 text-[10px] sm:text-[12px] font-bold text-amber-500/80">
                        <Info className="w-3.5 h-3.5 sm:w-4 h-4" />
                        <span>Expected payment on {format(new Date(dividend.payDate!), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
