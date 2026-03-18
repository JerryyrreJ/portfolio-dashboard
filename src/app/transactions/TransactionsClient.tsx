'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';
import {
  Filter, Download, TrendingUp, Search, ChevronRight, Edit2, Trash2, Check, X, User
} from 'lucide-react';
import { useCurrency } from '@/lib/useCurrency';
import { getCurrencySymbol } from '@/lib/currency';
import { usePreferences } from '@/lib/usePreferences';

interface TransactionWithAsset {
  id: string;
  type: string;
  quantity: number;
  price: number;
  priceUSD: number;
  fee: number;
  currency: string;
  date: Date;
  notes?: string | null;
  asset: {
    id: string;
    ticker: string;
    name: string;
    market: string;
    logo?: string | null;
  };
}

interface EditState {
  date: string;
  quantity: string;
  price: string;
  fee: string;
  notes: string;
}

interface TransactionsClientProps {
  transactions: TransactionWithAsset[];
  total: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  portfolioName: string;
  logoMap: Record<string, string | null>;
  searchTicker?: string;
  searchType?: string;
  buyCount: number;
  sellCount: number;
  totalVolume: number;
  userDisplayName?: string;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
        <Search className="w-6 h-6 text-gray-300" />
      </div>
      <p className="font-medium">No transactions found</p>
    </div>
  );
}

function formatNumber(num: number, decimals: number = 4): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export default function TransactionsClient({
  transactions: initialTransactions, total, totalPages, currentPage, limit,
  portfolioName, logoMap, searchTicker, searchType,
  buyCount, sellCount, totalVolume, userDisplayName = '',
}: TransactionsClientProps) {
  const { fmt, symbol } = useCurrency();
  const { colors } = usePreferences();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openEdit = (tx: TransactionWithAsset) => {
    setEditingId(tx.id);
    setConfirmingId(null);
    setEditState({
      date: format(new Date(tx.date), 'yyyy-MM-dd'),
      quantity: String(Math.abs(tx.quantity)),
      price: String(tx.price),
      fee: String(tx.fee),
      notes: tx.notes ?? '',
    });
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  const handleSave = async (tx: TransactionWithAsset) => {
    if (!editState) return;
    setIsSaving(true);
    const prev = transactions;
    const quantity = parseFloat(editState.quantity);
    // Optimistic update
    setTransactions(ts => ts.map(t => t.id === tx.id
      ? { ...t, date: new Date(editState.date), quantity, price: parseFloat(editState.price), fee: parseFloat(editState.fee), notes: editState.notes || null }
      : t
    ));
    closeEdit();
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editState.date,
          quantity,
          price: parseFloat(editState.price),
          fee: parseFloat(editState.fee),
          notes: editState.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTransactions(prev);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const prev = transactions;
    setTransactions(t => t.filter(tx => tx.id !== id));
    setConfirmingId(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setTransactions(prev);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">

      {/* 顶部导航栏 */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight cursor-pointer">
            <Link href="/" className="flex items-center space-x-2">
              <div className="bg-black text-white p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Folio</span>
            </Link>
          </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-400">
            <Link href="/" className="hover:text-black transition-colors py-[16px]">Investments</Link>
            <Link href="/transactions" className="text-black border-b-2 border-black py-[16px]">Transactions</Link>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions"
              className="bg-gray-100 border-none rounded-lg py-1.5 pl-9 pr-4 text-[13px] w-44 focus:w-60 focus:ring-1 focus:ring-black/5 focus:bg-white transition-all duration-300"
            />
          </div>
          <Link
            href="/settings"
            className="flex items-center space-x-2.5 group transition-all"
          >
            {userDisplayName ? (
              <>
                <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center font-bold text-[12px] group-hover:bg-gray-800 transition-colors shadow-sm shrink-0">
                  {userDisplayName[0].toUpperCase()}
                </div>
                <span className="text-[13px] font-bold text-gray-500 group-hover:text-black transition-colors hidden sm:block">
                  {userDisplayName}
                </span>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 text-gray-500 flex items-center justify-center group-hover:bg-gray-200 transition-colors shadow-sm shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span className="text-[13px] font-bold text-gray-500 group-hover:text-black transition-colors hidden sm:block">
                  Guest
                </span>
              </>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Breadcrumbs & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 text-[12px] sm:text-[13px] font-medium text-gray-400 mb-1.5 sm:mb-2">
              <Link href="/" className="hover:text-black transition-colors">Dashboard</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-900">Transactions</span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-bold text-black tracking-tight leading-tight">Transaction History</h1>
            <p className="text-gray-500 font-medium mt-1 text-[13px] sm:text-[15px]">{total} recorded activities in {portfolioName}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Total Volume</p>
            <p className="text-[18px] sm:text-[20px] font-bold text-black text-center tabular-nums">{fmt(totalVolume)}</p>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Buy Activity</p>
            <p className={`text-[18px] sm:text-[20px] font-bold text-center tabular-nums ${colors.gain.tailwind.text}`}>{buyCount} Orders</p>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Sell Activity</p>
            <p className={`text-[18px] sm:text-[20px] font-bold text-center tabular-nums ${colors.loss.tailwind.text}`}>{sellCount} Orders</p>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Avg. Order</p>
            <p className="text-[18px] sm:text-[20px] font-bold text-black text-center tabular-nums">{fmt(total > 0 ? totalVolume / total : 0)}</p>
          </div>
        </div>

        {/* Transactions Container */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4 text-center">Side</th>
                  <th className="px-6 py-4 text-right">Shares</th>
                  <th className="px-6 py-4 text-right">Unit Price</th>
                  <th className="px-6 py-4 text-right">Total Amount</th>
                  <th className="px-6 py-4 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <React.Fragment key={transaction.id}>
                      <tr className={`transition-all group ${editingId === transaction.id ? 'bg-gray-50/80' : 'hover:bg-gray-50/80'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-[13px] font-semibold text-black leading-tight">
                            {format(new Date(transaction.date), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link href={`/stock/${transaction.asset.ticker}`} className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                              {logoMap[transaction.asset.ticker] ? (
                                <Image src={logoMap[transaction.asset.ticker]!} alt={transaction.asset.ticker} width={36} height={36} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] font-bold text-gray-800">{transaction.asset.ticker.charAt(0)}</span>
                              )}
                            </div>
                            <div>
                              <p className="text-[14px] font-bold text-black leading-tight group-hover:underline underline-offset-2">{transaction.asset.ticker}</p>
                              <p className="text-[11px] text-gray-400 font-medium truncate max-w-[150px]">{transaction.asset.name}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${transaction.type === 'BUY' ? `${colors.gain.tailwind.bgLight} ${colors.gain.tailwind.text}` : `${colors.loss.tailwind.bgLight} ${colors.loss.tailwind.text}`}`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <p className="text-[13px] font-semibold text-black tabular-nums">{formatNumber(transaction.quantity)}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <p className="text-[13px] font-medium text-gray-600 tabular-nums">{fmt(transaction.priceUSD || transaction.price)}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <p className="text-[14px] font-bold text-black tabular-nums">{fmt((transaction.priceUSD || transaction.price) * Math.abs(transaction.quantity))}</p>
                          {transaction.fee > 0 && (
                            <p className="text-[10px] text-gray-400 font-medium">Fee: {getCurrencySymbol(transaction.currency ?? 'USD')}{transaction.fee.toFixed(2)}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {confirmingId === transaction.id ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleDelete(transaction.id)}
                                className="px-2.5 py-1 text-[11px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="px-2.5 py-1 text-[11px] font-bold text-gray-400 hover:text-black bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => editingId === transaction.id ? closeEdit() : openEdit(transaction)}
                                className={`p-1.5 transition-all duration-300 rounded-md ${editingId === transaction.id ? 'text-black bg-gray-100 scale-110 ring-4 ring-black/5' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}
                              >
                                {editingId === transaction.id
                                  ? <X className="w-3.5 h-3.5" />
                                  : <Edit2 className="w-3.5 h-3.5" />
                                }
                              </button>
                              <button
                                onClick={() => setConfirmingId(transaction.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded-md hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Edit Drawer Row — always rendered, animated via grid-rows */}
                      <tr className={editingId === transaction.id ? 'bg-gray-50/60' : ''}>
                        <td colSpan={7} className="p-0">
                          <div className={`grid transition-all duration-300 ease-in-out ${editingId === transaction.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                              <div className="px-6 pb-5 pt-3 border-t border-gray-100/60">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</label>
                                    <input
                                      type="date"
                                      value={editState?.date ?? ''}
                                      onChange={e => setEditState(s => s ? { ...s, date: e.target.value } : s)}
                                      className="w-full px-3 py-2 bg-white rounded-xl text-[13px] font-semibold text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shares</label>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      value={editState?.quantity ?? ''}
                                      onChange={e => setEditState(s => s ? { ...s, quantity: e.target.value } : s)}
                                      onWheel={e => (e.target as HTMLInputElement).blur()}
                                      className="w-full px-3 py-2 bg-white rounded-xl text-[13px] font-semibold tabular-nums text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                      Unit Price <span className="text-gray-300">·</span> {getCurrencySymbol(transaction.currency ?? 'USD')}
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editState?.price ?? ''}
                                      onChange={e => setEditState(s => s ? { ...s, price: e.target.value } : s)}
                                      onWheel={e => (e.target as HTMLInputElement).blur()}
                                      className="w-full px-3 py-2 bg-white rounded-xl text-[13px] font-semibold tabular-nums text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                      Fee <span className="text-gray-300">·</span> {getCurrencySymbol(transaction.currency ?? 'USD')}
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editState?.fee ?? ''}
                                      onChange={e => setEditState(s => s ? { ...s, fee: e.target.value } : s)}
                                      onWheel={e => (e.target as HTMLInputElement).blur()}
                                      className="w-full px-3 py-2 bg-white rounded-xl text-[13px] font-semibold tabular-nums text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes</label>
                                  <input
                                    type="text"
                                    value={editState?.notes ?? ''}
                                    onChange={e => setEditState(s => s ? { ...s, notes: e.target.value } : s)}
                                    placeholder="Optional"
                                    className="w-full px-3 py-2 bg-white rounded-xl text-[13px] font-medium text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => handleSave(transaction)}
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white bg-black hover:bg-gray-800 rounded-xl transition-colors active:scale-95 disabled:opacity-50 shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-gray-50">
            {transactions.length === 0 ? (
              <div className="px-6 py-16 text-center text-gray-400">
                <EmptyState />
              </div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className={`transition-colors ${editingId === transaction.id ? 'bg-gray-50/80' : ''}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                          {logoMap[transaction.asset.ticker] ? (
                            <Image src={logoMap[transaction.asset.ticker]!} alt={transaction.asset.ticker} width={40} height={40} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[12px] font-bold text-gray-800">{transaction.asset.ticker.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-bold text-black leading-tight">{transaction.asset.ticker}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${transaction.type === 'BUY' ? `${colors.gain.tailwind.bgLight} ${colors.gain.tailwind.text}` : `${colors.loss.tailwind.bgLight} ${colors.loss.tailwind.text}`}`}>
                              {transaction.type}
                            </span>
                          </div>
                          <p className="text-[12px] text-gray-400 font-medium truncate max-w-[140px]">{transaction.asset.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-bold text-black tabular-nums">{fmt((transaction.priceUSD || transaction.price) * Math.abs(transaction.quantity))}</p>
                        <p className="text-[12px] text-gray-400 font-medium tabular-nums">{formatNumber(transaction.quantity)} shares</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-[12px] text-gray-400 font-medium">
                        {format(new Date(transaction.date), 'MMM dd, yyyy')}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => editingId === transaction.id ? closeEdit() : openEdit(transaction)}
                          className={`text-[12px] font-semibold transition-colors ${editingId === transaction.id ? 'text-black' : 'text-gray-400'}`}
                        >
                          {editingId === transaction.id ? 'Close' : 'Edit'}
                        </button>
                        {confirmingId === transaction.id ? (
                          <>
                            <button onClick={() => handleDelete(transaction.id)} className="text-[12px] font-bold text-rose-500">Confirm</button>
                            <button onClick={() => setConfirmingId(null)} className="text-[12px] font-semibold text-gray-400">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmingId(transaction.id)} className="text-[12px] font-semibold text-rose-400">Delete</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Edit Drawer — always rendered, animated via grid-rows */}
                  <div className={`grid transition-all duration-300 ease-in-out ${editingId === transaction.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100/60">
                        <div className="grid grid-cols-2 gap-3 pt-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</label>
                            <input
                              type="date"
                              value={editState?.date ?? ''}
                              onChange={e => setEditState(s => s ? { ...s, date: e.target.value } : s)}
                              className="w-full px-3 py-2 bg-gray-50/50 rounded-xl text-[13px] font-semibold text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shares</label>
                            <input
                              type="number"
                              step="0.0001"
                              value={editState?.quantity ?? ''}
                              onChange={e => setEditState(s => s ? { ...s, quantity: e.target.value } : s)}
                              onWheel={e => (e.target as HTMLInputElement).blur()}
                              className="w-full px-3 py-2 bg-gray-50/50 rounded-xl text-[13px] font-semibold tabular-nums text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                              Unit Price <span className="text-gray-300">·</span> {getCurrencySymbol(transaction.currency ?? 'USD')}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editState?.price ?? ''}
                              onChange={e => setEditState(s => s ? { ...s, price: e.target.value } : s)}
                              onWheel={e => (e.target as HTMLInputElement).blur()}
                              className="w-full px-3 py-2 bg-gray-50/50 rounded-xl text-[13px] font-semibold tabular-nums text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                              Fee <span className="text-gray-300">·</span> {getCurrencySymbol(transaction.currency ?? 'USD')}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editState?.fee ?? ''}
                              onChange={e => setEditState(s => s ? { ...s, fee: e.target.value } : s)}
                              onWheel={e => (e.target as HTMLInputElement).blur()}
                              className="w-full px-3 py-2 bg-gray-50/50 rounded-xl text-[13px] font-semibold tabular-nums text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes</label>
                          <input
                            type="text"
                            value={editState?.notes ?? ''}
                            onChange={e => setEditState(s => s ? { ...s, notes: e.target.value } : s)}
                            placeholder="Optional"
                            className="w-full px-3 py-2 bg-gray-50/50 rounded-xl text-[13px] font-medium text-black border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                          />
                        </div>
                        <button
                          onClick={() => handleSave(transaction)}
                          disabled={isSaving}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold text-white bg-black hover:bg-gray-800 rounded-xl transition-colors active:scale-[0.98] disabled:opacity-50 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4">
            <p className="text-[13px] font-medium text-gray-400 px-2 order-2 sm:order-1">
              Showing {((currentPage - 1) * limit) + 1}–{Math.min(currentPage * limit, total)} of {total}
            </p>
            <div className="flex items-center bg-white border border-gray-200 rounded-full p-1 shadow-sm order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-start">
              <a
                href={`/transactions?page=${currentPage - 1}${searchTicker ? `&ticker=${searchTicker}` : ''}${searchType ? `&type=${searchType}` : ''}`}
                className={`flex-1 sm:flex-none text-center px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all ${currentPage <= 1 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-600 hover:text-black hover:bg-gray-50'}`}
              >
                Previous
              </a>
              <div className="w-px h-4 bg-gray-100 mx-1 hidden sm:block"></div>
              <span className="px-4 py-1.5 text-[13px] font-bold text-black">
                {currentPage} <span className="text-gray-300 font-medium">/</span> {totalPages}
              </span>
              <div className="w-px h-4 bg-gray-100 mx-1 hidden sm:block"></div>
              <a
                href={`/transactions?page=${currentPage + 1}${searchTicker ? `&ticker=${searchTicker}` : ''}${searchType ? `&type=${searchType}` : ''}`}
                className={`flex-1 sm:flex-none text-center px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all ${currentPage >= totalPages ? 'text-gray-200 cursor-not-allowed' : 'text-gray-600 hover:text-black hover:bg-gray-50'}`}
              >
                Next
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
