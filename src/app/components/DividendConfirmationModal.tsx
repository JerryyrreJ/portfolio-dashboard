'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrencySymbol } from '@/lib/currency';

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

  // Fetch pending dividends
  const fetchPendingDividends = async () => {
    if (!portfolioId || portfolioId === 'local-portfolio') return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/dividends/pending?portfolioId=${portfolioId}`);
      if (!response.ok) throw new Error('Failed to fetch pending dividends');

      const data = await response.json();
      setPendingDividends(data.dividends || []);
    } catch (err) {
      console.error('Error fetching pending dividends:', err);
      setError('Failed to load pending dividends');
    } finally {
      setIsLoading(false);
    }
  };

  // Sync dividends from API
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

      if (!response.ok) throw new Error('Failed to sync dividends');

      await fetchPendingDividends();
    } catch (err) {
      console.error('Error syncing dividends:', err);
      setError('Failed to sync dividends');
    } finally {
      setIsSyncing(false);
    }
  };

  // Confirm a dividend
  const handleConfirm = async (dividendId: string) => {
    setProcessingIds(prev => new Set(prev).add(dividendId));
    setError(null);
    try {
      const finalAmount = editedAmounts[dividendId];
      const response = await fetch('/api/transactions/dividends/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dividendId,
          ...(finalAmount !== undefined && { finalAmount })
        }),
      });

      if (!response.ok) throw new Error('Failed to confirm dividend');

      setPendingDividends(prev => prev.filter(d => d.id !== dividendId));
      setEditingId(null);
      const newAmounts = { ...editedAmounts };
      delete newAmounts[dividendId];
      setEditedAmounts(newAmounts);

      if (onConfirmed) onConfirmed();
    } catch (err) {
      console.error('Error confirming dividend:', err);
      setError('Failed to confirm dividend');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(dividendId);
        return next;
      });
    }
  };

  // Ignore a dividend
  const handleIgnore = async (dividendId: string) => {
    setProcessingIds(prev => new Set(prev).add(dividendId));
    try {
      const response = await fetch('/api/transactions/dividends/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dividendId }),
      });

      if (!response.ok) throw new Error('Failed to ignore dividend');

      setPendingDividends(prev => prev.filter(d => d.id !== dividendId));
    } catch (err) {
      console.error('Error ignoring dividend:', err);
      setError('Failed to ignore dividend');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(dividendId);
        return next;
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPendingDividends();
    }
  }, [isOpen, portfolioId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 backdrop-blur-md transition-all p-4">
      <div className="relative w-full max-w-[700px] bg-card rounded-[28px] sm:rounded-[32px] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.15)] border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8 pb-4 flex items-center justify-between sticky top-0 bg-card/90 backdrop-blur-sm z-20 border-b border-border">
          <div>
            <h2 className="text-[20px] sm:text-[24px] font-bold text-primary tracking-tight leading-none">Dividend Confirmation</h2>
            <p className="text-[12px] sm:text-[13px] text-secondary font-medium mt-1.5 sm:mt-2">Review and confirm your dividend payments</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary transition-colors rounded-full hover:bg-element bg-element/50 sm:bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 pt-4 space-y-4">

          {/* Sync Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-element hover:bg-element-hover rounded-[16px] text-[13px] font-bold text-primary transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Sync Dividends
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[13px] font-bold text-rose-900 leading-tight">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && pendingDividends.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-element flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-[16px] font-bold text-primary mb-2">All caught up!</h3>
              <p className="text-[13px] text-secondary font-medium max-w-[300px]">
                No pending dividends to confirm. Click &quot;Sync Dividends&quot; to check for new payments.
              </p>
            </div>
          )}

          {/* Dividend List */}
          {!isLoading && pendingDividends.map((dividend) => {
            const isEditing = editingId === dividend.id;
            const isProcessing = processingIds.has(dividend.id);
            const displayAmount = editedAmounts[dividend.id] ?? dividend.calculatedAmount;
            const currencySymbol = getCurrencySymbol(dividend.currency);

            return (
              <div
                key={dividend.id}
                className="bg-element/50 rounded-[20px] p-5 border border-border hover:border-border-hover transition-all"
              >
                {/* Stock Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-card shadow-sm flex items-center justify-center font-bold text-primary border border-border overflow-hidden shrink-0">
                    {dividend.logo ? (
                      <img src={dividend.logo} alt={dividend.ticker} className="w-full h-full object-cover" />
                    ) : (
                      dividend.ticker.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary leading-tight">{dividend.ticker}</p>
                    <p className="text-[11px] text-secondary font-medium truncate">{dividend.name}</p>
                  </div>
                </div>

                {/* Dividend Details */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-card/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Ex-Date</p>
                    <p className="text-[13px] font-bold text-primary flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-secondary" />
                      {format(new Date(dividend.exDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="bg-card/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Shares Held</p>
                    <p className="text-[13px] font-bold text-primary tabular-nums">
                      {dividend.sharesHeld.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </p>
                  </div>
                </div>

                {/* Amount Section */}
                <div className="bg-element border border-border rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Calculated Amount</p>
                    {!isEditing && (
                      <button
                        onClick={() => {
                          setEditingId(dividend.id);
                          setEditedAmounts(prev => ({ ...prev, [dividend.id]: dividend.calculatedAmount }));
                        }}
                        className="text-[11px] font-bold text-secondary hover:text-primary transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                        <input
                          type="number"
                          step="0.01"
                          value={displayAmount}
                          onChange={(e) => setEditedAmounts(prev => ({ ...prev, [dividend.id]: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-[14px] font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary/20"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          const newAmounts = { ...editedAmounts };
                          delete newAmounts[dividend.id];
                          setEditedAmounts(newAmounts);
                        }}
                        className="px-3 py-2.5 text-[12px] font-bold text-secondary hover:text-primary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-[20px] font-bold text-primary tabular-nums">
                      {currencySymbol}{displayAmount.toFixed(2)}
                    </p>
                  )}

                  <p className="text-[11px] text-secondary font-medium mt-2">
                    {dividend.sharesHeld.toFixed(4)} shares × {currencySymbol}{dividend.dividendPerShare.toFixed(4)} per share
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(dividend.id)}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-primary hover:bg-primary-hover text-on-primary text-[14px] font-bold rounded-[16px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Confirm
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleIgnore(dividend.id)}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-element hover:bg-element-hover text-secondary hover:text-primary text-[14px] font-bold rounded-[16px] transition-all disabled:opacity-50 border border-border"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
