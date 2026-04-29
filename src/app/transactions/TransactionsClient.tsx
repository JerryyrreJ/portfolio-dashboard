'use client';

import React, { startTransition, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Filter, Download, TrendingUp, Search, ChevronRight, Edit2, Trash2, Check, X, User, RefreshCw, FileSpreadsheet, FileText, FileJson
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CachedAssetLogo from '@/app/components/CachedAssetLogo';
import { useCurrency } from '@/lib/useCurrency';
import { getCurrencySymbol } from '@/lib/currency';
import { usePreferences } from '@/lib/usePreferences';
import type { PortfolioClientRecord } from '@/lib/portfolio-client';
import {
  buildTransactionExportFilename,
  downloadTextFile,
  getLocalTransactionExportPayload,
  serializeTransactionExportCsv,
} from '@/lib/local-transaction-export';
import { toPortfolioSelectionHref } from '@/lib/portfolio-links';

interface TransactionWithAsset {
  id: string;
  type: string;
  eventId?: string | null;
  source?: string | null;
  subtype?: string | null;
  isSystemGenerated?: boolean;
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
  portfolio: {
    id: string;
    name: string;
  };
}

interface EditState {
  date: string;
  quantity: string;
  price: string;
  fee: string;
  notes: string;
}

type DownloadableExportFormat = 'csv' | 'json';
type ExportFormat = DownloadableExportFormat | 'pdf';

type ExportTransaction = {
  transactionId: string;
  portfolioId: string;
  portfolioName: string;
  date: string;
  ticker: string;
  name: string;
  market: string;
  type: string;
  quantity: number;
  price: number;
  priceUSD: number;
  currency: string;
  exchangeRate: number;
  fee: number;
  grossAmount: number;
  grossAmountUSD: number;
  totalValue: string;
  totalValueUSD: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type ExportPayload = {
  portfolio: {
    id: string;
    name: string;
    currency: string;
  };
  exportDate: string;
  range: 'all' | 'ytd' | '12m';
  filters: {
    ticker: string | null;
    type: 'BUY' | 'SELL' | 'DIVIDEND' | null;
  };
  transactionCount: number;
  transactions: ExportTransaction[];
};

type ExportPdfRow = {
  date: string;
  asset: string;
  type: string;
  quantity: string;
  price: string;
  fee: string;
  total: string;
  currency: string;
};

interface TransactionsClientProps {
  transactions: TransactionWithAsset[];
  total: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  portfolioId: string;
  portfolioName: string;
  selectedPortfolioIds?: string[];
  selectionMode?: 'single' | 'multi';
  initialPortfolios: PortfolioClientRecord[];
  logoMap: Record<string, string | null>;
  searchTicker?: string;
  searchType?: string;
  buyCount: number;
  sellCount: number;
  totalVolume: number;
  userDisplayName?: string;
}

function EmptyState() {
  const t = useTranslations('transactions');
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="w-12 h-12 bg-element rounded-full flex items-center justify-center">
        <Search className="w-6 h-6 text-secondary" />
      </div>
      <p className="font-medium text-secondary">{t('noTransactionsFound')}</p>
    </div>
  );
}

function formatNumber(num: number, locale: string, decimals: number = 4): string {
  return num.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function formatExportAmount(num: number, locale: string, decimals: number = 2): string {
  return num.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export default function TransactionsClient({
  transactions: initialTransactions, total, totalPages, currentPage, limit,
  portfolioId, portfolioName, selectedPortfolioIds = [], selectionMode = 'single', initialPortfolios, logoMap, searchTicker, searchType,
  buyCount, sellCount, totalVolume, userDisplayName = '',
}: TransactionsClientProps) {
  const router = useRouter();
  const t = useTranslations('transactions');
  const locale = useLocale();
  const { fmt, convert, symbol } = useCurrency();
  const { colors } = usePreferences({
    initialPortfolios,
    cloudSync: !!portfolioId,
  });
  const [transactions, setTransactions] = useState(initialTransactions);
  const refreshedProfileLogosForPortfolioRef = useRef<string | null>(null);
  const effectiveSelectedPortfolioIds = selectedPortfolioIds.length > 0
    ? selectedPortfolioIds
    : (portfolioId ? [portfolioId] : []);
  const selectionKey = effectiveSelectedPortfolioIds.join(',');
  const dashboardHref = portfolioId ? toPortfolioSelectionHref('/app', effectiveSelectedPortfolioIds) : '/app';
  const transactionsBaseHref = portfolioId ? toPortfolioSelectionHref('/transactions', effectiveSelectedPortfolioIds) : '/transactions';
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  
  // States for interactive panels
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [filterType, setFilterType] = useState(searchType || 'ALL');
  const [filterTicker, setFilterTicker] = useState(searchTicker || '');
  const isLocalPortfolio = !portfolioId || portfolioId === 'local-portfolio';
  
  const isFilterActive = filterType !== 'ALL' || filterTicker !== '';

  const shortDateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  useEffect(() => {
    if (!portfolioId || portfolioId === 'local-portfolio') return;
    if (refreshedProfileLogosForPortfolioRef.current === selectionKey) return;

    const tickers = [...new Set(transactions.map((transaction) => transaction.asset.ticker).filter(Boolean))];
    if (tickers.length === 0) return;

    refreshedProfileLogosForPortfolioRef.current = selectionKey;
    let cancelled = false;

    const refreshVisibleAssetProfiles = async () => {
      const results = await Promise.allSettled(
        tickers.map((ticker) => fetch(`/api/assets/${encodeURIComponent(ticker)}/sync?force=profile`, {
          method: 'POST',
        }))
      );

      if (cancelled) return;

      const hasSuccessfulRefresh = results.some(
        (result) => result.status === 'fulfilled' && result.value.ok
      );

      if (hasSuccessfulRefresh) {
        startTransition(() => router.refresh());
      }
    };

    void refreshVisibleAssetProfiles();

    return () => {
      cancelled = true;
    };
  }, [portfolioId, router, selectionKey, transactions]);

  const getTransactionTypeLabel = (type: string) => {
    if (type === 'BUY') return t('types.buy');
    if (type === 'SELL') return t('types.sell');
    if (type === 'DIVIDEND') return t('types.dividend');
    return type;
  };

  const getTransactionTag = (transaction: TransactionWithAsset) => {
    if (transaction.subtype === 'DRIP') return 'DRIP';
    if (transaction.subtype === 'REINVESTED_DIVIDEND') return 'Reinvested';
    return null;
  };

  const isManagedDripTransaction = (transaction: TransactionWithAsset) => (
    transaction.source === 'drip' ||
    transaction.subtype === 'DRIP' ||
    transaction.subtype === 'REINVESTED_DIVIDEND'
  );

  const getExportFilterLabel = () => {
    const parts: string[] = [];

    if (filterType !== 'ALL') {
      parts.push(`${t('exportFilterType')}: ${getTransactionTypeLabel(filterType)}`);
    }

    if (filterTicker.trim()) {
      parts.push(`${t('exportFilterTicker')}: ${filterTicker.trim().toUpperCase()}`);
    }

    return parts.length > 0 ? parts.join('  ·  ') : t('exportFilterAll');
  };

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

    const isManaged = isManagedDripTransaction(tx);
    setIsSaving(true);
    const prev = transactions;
    const quantity = parseFloat(editState.quantity);
    if (!isManaged) {
      setTransactions(ts => ts.map(t => t.id === tx.id
        ? { ...t, date: new Date(editState.date), quantity, price: parseFloat(editState.price), fee: parseFloat(editState.fee), notes: editState.notes || null }
        : t
      ));
    }
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
      if (isManaged) {
        startTransition(() => router.refresh());
      }
    } catch {
      if (!isManaged) {
        setTransactions(prev);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tx: TransactionWithAsset) => {
    const isManaged = isManagedDripTransaction(tx);
    const prev = transactions;
    if (isManaged && tx.eventId) {
      setTransactions((currentTransactions) => currentTransactions.filter((currentTx) => currentTx.eventId !== tx.eventId));
    } else {
      setTransactions((currentTransactions) => currentTransactions.filter((currentTx) => currentTx.id !== tx.id));
    }
    setConfirmingId(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      startTransition(() => router.refresh());
    } catch {
      setTransactions(prev);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);

    try {
      const localPayload = isLocalPortfolio
        ? getLocalTransactionExportPayload({
            range: 'all',
            portfolioName,
            type: filterType !== 'ALL' ? filterType : null,
            ticker: filterTicker.trim(),
          })
        : null;

      if (format === 'pdf') {
        const data = localPayload ?? await (async () => {
          const params = new URLSearchParams({ format: 'json' });

          if (effectiveSelectedPortfolioIds.length > 1) {
            params.set('pids', effectiveSelectedPortfolioIds.join(','));
          } else if (portfolioId) {
            params.set('portfolioId', portfolioId);
          }
          if (filterType !== 'ALL') params.set('type', filterType);
          if (filterTicker.trim()) params.set('ticker', filterTicker.trim());

          const response = await fetch(`/api/transactions/export?${params.toString()}`);
          if (!response.ok) {
            throw new Error('Export failed');
          }

          return response.json() as Promise<ExportPayload>;
        })();
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const generatedAt = new Date();
        const currentYStart = 44;
        const totalInBaseCurrency = data.transactions.reduce(
          (sum, transaction) => sum + convert(Number(transaction.totalValueUSD)),
          0
        );
        const buyTransactionCount = data.transactions.filter((transaction) => transaction.type === 'BUY').length;
        const sellTransactionCount = data.transactions.filter((transaction) => transaction.type === 'SELL').length;
        const dividendTransactionCount = data.transactions.filter((transaction) => transaction.type === 'DIVIDEND').length;
        const pdfRows: ExportPdfRow[] = data.transactions.map((transaction) => {
          const currencySymbol = getCurrencySymbol(transaction.currency);
          return {
            date: transaction.date,
            asset: `${transaction.ticker}\n${transaction.name}`,
            type: getTransactionTypeLabel(transaction.type),
            quantity: transaction.type === 'DIVIDEND' ? '—' : formatNumber(transaction.quantity, locale),
            price: `${currencySymbol}${formatExportAmount(transaction.price, locale)}`,
            fee: `${currencySymbol}${formatExportAmount(transaction.fee, locale)}`,
            total: `${currencySymbol}${formatExportAmount(transaction.grossAmount, locale)}`,
            currency: transaction.currency,
          };
        });

        doc.setFillColor(30, 30, 30);
        doc.rect(0, 0, pageWidth, 20, 'F');
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Folio', 14, 12.5);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(t('title'), pageWidth - 14, 12.5, { align: 'right' });

        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`${data.portfolio.name}  ·  ${data.portfolio.currency}`, 14, 28);
        doc.text(new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        }).format(generatedAt), pageWidth - 14, 28, { align: 'right' });

        doc.setFontSize(8.5);
        doc.setTextColor(110, 110, 110);
        doc.text(getExportFilterLabel(), 14, 34);

        doc.setDrawColor(225, 225, 225);
        doc.setLineWidth(0.3);
        doc.line(14, 38, pageWidth - 14, 38);

        const statBoxes = [
          { label: t('exportSummaryTransactions'), value: String(data.transactionCount) },
          { label: t('exportSummaryBuys'), value: String(buyTransactionCount) },
          { label: t('exportSummarySells'), value: String(sellTransactionCount) },
          { label: t('exportSummaryDividends'), value: String(dividendTransactionCount) },
          { label: t('exportSummaryTotal'), value: `${symbol}${formatExportAmount(totalInBaseCurrency, locale)}` },
        ];
        const statGap = 3;
        const statBoxWidth = (pageWidth - 28 - statGap * 4) / 5;

        statBoxes.forEach((box, index) => {
          const x = 14 + index * (statBoxWidth + statGap);
          doc.setFillColor(248, 248, 248);
          doc.roundedRect(x, currentYStart, statBoxWidth, 16, 1.5, 1.5, 'F');
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text(box.label.toUpperCase(), x + 3, currentYStart + 5);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text(box.value, x + 3, currentYStart + 12);
        });

        autoTable(doc, {
          startY: currentYStart + 24,
          columns: [
            { header: t('date'), dataKey: 'date' },
            { header: t('asset'), dataKey: 'asset' },
            { header: t('side'), dataKey: 'type' },
            { header: t('shares'), dataKey: 'quantity' },
            { header: t('unitPrice'), dataKey: 'price' },
            { header: t('fee'), dataKey: 'fee' },
            { header: t('totalAmount'), dataKey: 'total' },
            { header: t('exportCurrency'), dataKey: 'currency' },
          ],
          body: pdfRows,
          theme: 'plain',
          headStyles: {
            fillColor: [240, 240, 240],
            textColor: 60,
            fontStyle: 'bold',
            fontSize: 8,
            cellPadding: 4,
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 4,
            textColor: 40,
          },
          alternateRowStyles: { fillColor: [252, 252, 252] },
          styles: {
            font: 'helvetica',
            lineColor: [235, 235, 235],
            lineWidth: 0.1,
            overflow: 'linebreak',
          },
          columnStyles: {
            date: { cellWidth: 22 },
            asset: { cellWidth: 43 },
            type: { cellWidth: 18 },
            quantity: { cellWidth: 18, halign: 'right' },
            price: { cellWidth: 24, halign: 'right' },
            fee: { cellWidth: 20, halign: 'right' },
            total: { cellWidth: 26, halign: 'right' },
            currency: { cellWidth: 17, halign: 'center' },
          },
          margin: { top: 20, bottom: 16 },
        });

        const totalPages = doc.getNumberOfPages();
        const footerText = generatedAt.toLocaleString();
        for (let page = 1; page <= totalPages; page += 1) {
          doc.setPage(page);
          const footerY = doc.internal.pageSize.getHeight() - 8;
          doc.setFillColor(255, 255, 255);
          doc.rect(0, footerY - 5, pageWidth, 12, 'F');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(150, 150, 150);
          doc.text(footerText, 14, footerY);
          doc.text(`${t('exportPage')} ${page} / ${totalPages}`, pageWidth - 14, footerY, { align: 'right' });
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.2);
          doc.line(14, footerY - 3, pageWidth - 14, footerY - 3);
        }

        const dateLabel = generatedAt.toISOString().slice(0, 10);
        doc.save(`transaction_history_${data.portfolio.name.replace(/\s+/g, '_')}_${dateLabel}.pdf`);
        setIsExportOpen(false);
        return;
      }

      if (localPayload) {
        const filename = buildTransactionExportFilename(format, localPayload);
        const content = format === 'json'
          ? JSON.stringify(localPayload, null, 2)
          : serializeTransactionExportCsv(localPayload);
        const contentType = format === 'json'
          ? 'application/json; charset=utf-8'
          : 'text/csv; charset=utf-8';

        downloadTextFile(filename, content, contentType);
      } else {
        const params = new URLSearchParams({ format });

        if (effectiveSelectedPortfolioIds.length > 1) {
          params.set('pids', effectiveSelectedPortfolioIds.join(','));
        } else if (portfolioId) {
          params.set('portfolioId', portfolioId);
        }
        if (filterType !== 'ALL') params.set('type', filterType);
        if (filterTicker.trim()) params.set('ticker', filterTicker.trim());

        const response = await fetch(`/api/transactions/export?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Export failed');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);
        const filename = filenameMatch?.[1] || `portfolio_transactions.${format}`;

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      }
      setIsExportOpen(false);
    } catch (error) {
      console.error('Failed to export transactions:', error);
      window.alert(t('exportFailedMessage'));
    } finally {
      setExportingFormat(null);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesType = filterType === 'ALL' || tx.type === filterType;
    const matchesTicker = filterTicker === '' || tx.asset.ticker.toLowerCase().includes(filterTicker.toLowerCase());
    return matchesType && matchesTicker;
  });

  return (
    <div className="min-h-screen bg-page text-primary font-sans antialiased">
      {/* Header */}
      <header className="bg-card/70 backdrop-blur-xl border-b border-border px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <Link href={dashboardHref} className="flex items-center space-x-2 text-primary font-bold text-[17px] tracking-tight">
            <div className="bg-primary text-on-primary p-1 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span>Folio</span>
          </Link>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-secondary">
            <Link href={dashboardHref} className="hover:text-primary transition-colors py-[16px]">{t('nav.investments')}</Link>
            <Link href={transactionsBaseHref} className="text-primary border-b-2 border-primary py-[16px]">{t('nav.transactions')}</Link>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <Link href="/settings" className="flex items-center space-x-2.5 group transition-all">
            {userDisplayName ? (
              <>
                <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-[12px] group-hover:bg-primary-hover transition-colors shadow-sm shrink-0">
                  {userDisplayName[0].toUpperCase()}
                </div>
                <span className="text-[13px] font-bold text-secondary group-hover:text-primary transition-colors hidden sm:block">{userDisplayName}</span>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full bg-element-hover border border-border text-secondary flex items-center justify-center group-hover:bg-gray-200 transition-colors shadow-sm shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span className="text-[13px] font-bold text-secondary group-hover:text-primary transition-colors hidden sm:block">{t('guest')}</span>
              </>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Title Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 text-[12px] sm:text-[13px] font-medium text-secondary mb-1.5 sm:mb-2">
              <Link href={dashboardHref} className="hover:text-primary transition-colors">{t('breadcrumbDashboard')}</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-primary">{t('breadcrumbCurrent')}</span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-bold text-primary tracking-tight leading-tight">{t('title')}</h1>
            <p className="text-secondary font-medium mt-1 text-[13px] sm:text-[15px]">{t('subtitle', { count: total, portfolioName })}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button 
              onClick={() => {
                setIsFilterOpen(!isFilterOpen);
                if (!isFilterOpen) setIsExportOpen(false);
              }}
              className={`flex-1 sm:flex-none h-9 flex items-center justify-center gap-2 px-4 text-[13px] font-bold rounded-xl transition-all active:scale-95 shadow-sm ${isFilterOpen || (isFilterActive && !isExportOpen) ? 'bg-primary text-on-primary' : 'bg-card text-secondary border border-border hover:bg-element-hover'}`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{t('filter')}</span>
              {isFilterActive && !isFilterOpen && <div className="w-1.5 h-1.5 rounded-full bg-on-primary animate-pulse ml-0.5" />}
            </button>
            <button 
              onClick={() => {
                setIsExportOpen(!isExportOpen);
                if (!isExportOpen) setIsFilterOpen(false);
              }}
              className={`flex-1 sm:flex-none h-9 flex items-center justify-center gap-2 px-4 text-[13px] font-bold rounded-xl transition-all active:scale-95 shadow-sm ${isExportOpen ? 'bg-primary text-on-primary' : 'bg-card text-secondary border border-border hover:bg-element-hover'}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('export')}</span>
            </button>
          </div>
        </div>

        {/* Filter Drawer */}
        <div className={`grid transition-all duration-500 ease-out-expo ${isFilterOpen ? 'grid-rows-[1fr] opacity-100 mb-8' : 'grid-rows-[0fr] opacity-0 mb-0'}`}>
          <div className="overflow-hidden">
            <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border/60 shadow-sm flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
              <div className="flex-1 w-full sm:w-auto">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.15em] mb-2.5 ml-1 opacity-60">Type</p>
                <div className="bg-element/50 p-1 rounded-xl flex gap-1 border border-border/30">
                  {['ALL', 'BUY', 'SELL', 'DIVIDEND'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`flex-1 h-8 rounded-lg text-[12px] font-bold transition-all active:scale-95 ${filterType === type ? 'bg-white dark:bg-zinc-100 text-black shadow-sm' : 'text-secondary hover:text-primary'}`}
                    >
                      {type === 'ALL' ? 'All' : type.charAt(0) + type.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full sm:w-64">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.15em] mb-2.5 ml-1 opacity-60">Ticker</p>
                <div className="relative group">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40 group-focus-within:opacity-100 transition-all" />
                  <input
                    type="text"
                    value={filterTicker}
                    onChange={(e) => setFilterTicker(e.target.value.toUpperCase())}
                    placeholder="Search e.g. TSLA"
                    className="w-full h-10 bg-element/50 border border-border/40 rounded-xl pl-10 pr-4 text-[13px] font-bold text-primary focus:bg-card focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <p className="hidden sm:block text-[10px] font-bold text-transparent uppercase tracking-[0.15em] mb-2.5 ml-1 select-none">Actions</p>
                <button
                  onClick={() => { setFilterType('ALL'); setFilterTicker(''); }}
                  className={`h-10 px-6 rounded-xl text-[12px] font-bold transition-all active:scale-95 flex items-center justify-center w-full sm:w-auto ${isFilterActive ? 'text-primary bg-element hover:bg-element-hover shadow-sm border border-border/50' : 'text-secondary opacity-20 cursor-default'}`}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Export Drawer */}
        <div className={`grid transition-all duration-500 ease-out-expo ${isExportOpen ? 'grid-rows-[1fr] opacity-100 mb-8' : 'grid-rows-[0fr] opacity-0 mb-0'}`}>
          <div className="overflow-hidden">
            <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border/60 shadow-sm">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.15em] mb-4 ml-1 opacity-60">{t('selectExportFormat')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: 'csv', title: t('exportCsvTitle'), desc: t('exportCsvDescription'), icon: FileSpreadsheet, color: 'text-emerald-500', disabled: false },
                  { id: 'pdf', title: t('exportPdfTitle'), desc: t('exportPdfDescription'), icon: FileText, color: 'text-blue-500', disabled: false },
                  { id: 'json', title: t('exportJsonTitle'), desc: t('exportJsonDescription'), icon: FileJson, color: 'text-amber-500', disabled: false },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.disabled || exportingFormat !== null}
                    onClick={() => {
                      if (opt.id === 'csv' || opt.id === 'json' || opt.id === 'pdf') {
                        void handleExport(opt.id);
                      }
                    }}
                    className={`flex flex-col items-start p-4 rounded-xl border transition-all group text-left ${opt.disabled ? 'bg-element/20 border-border/20 opacity-55 cursor-not-allowed' : 'bg-element/40 border-border/30 hover:bg-element hover:border-border/80 active:scale-[0.98]'} ${exportingFormat !== null && exportingFormat !== opt.id ? 'opacity-60' : ''}`}
                  >
                    <div className={`p-2.5 rounded-lg bg-card shadow-sm mb-3 transition-transform ${!opt.disabled ? 'group-hover:scale-110' : ''} ${opt.color}`}>
                      {exportingFormat === opt.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <opt.icon className="w-5 h-5" />}
                    </div>
                    <p className="text-[14px] font-bold text-primary mb-1">
                      {exportingFormat === opt.id ? t('exportPreparing') : opt.title}
                    </p>
                    <p className="text-[11px] text-secondary font-medium opacity-60">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
          <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-[10px] sm:text-[11px] text-secondary font-bold uppercase tracking-wider mb-1 text-center">{t('totalVolume')}</p>
            <p className="text-[18px] sm:text-[20px] font-bold text-primary text-center tabular-nums">{fmt(totalVolume)}</p>
          </div>
          <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-[10px] sm:text-[11px] text-secondary font-bold uppercase tracking-wider mb-1 text-center">{t('buyActivity')}</p>
            <p className={`text-[18px] sm:text-[20px] font-bold text-center tabular-nums ${colors.gain.tailwind.text}`}>{t('orders', { count: buyCount })}</p>
          </div>
          <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-[10px] sm:text-[11px] text-secondary font-bold uppercase tracking-wider mb-1 text-center">{t('sellActivity')}</p>
            <p className={`text-[18px] sm:text-[20px] font-bold text-center tabular-nums ${colors.loss.tailwind.text}`}>{t('orders', { count: sellCount })}</p>
          </div>
          <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-[10px] sm:text-[11px] text-secondary font-bold uppercase tracking-wider mb-1 text-center">{t('avgOrder')}</p>
            <p className="text-[18px] sm:text-[20px] font-bold text-primary text-center tabular-nums">{fmt(total > 0 ? totalVolume / total : 0)}</p>
          </div>
        </div>

        {/* Table/List Container */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-element/50 text-[10px] font-bold text-secondary uppercase tracking-widest border-b border-border">
                  <th className="px-6 py-4">{t('dateTime')}</th>
                  <th className="px-6 py-4">{t('asset')}</th>
                  <th className="px-6 py-4 text-center">{t('side')}</th>
                  <th className="px-6 py-4 text-right">{t('shares')}</th>
                  <th className="px-6 py-4 text-right">{t('unitPrice')}</th>
                  <th className="px-6 py-4 text-right">{t('totalAmount')}</th>
                  <th className="px-6 py-4 text-center w-24">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState /></td></tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <React.Fragment key={tx.id}>
                      <tr className={`group transition-all ${editingId === tx.id ? 'bg-element/80' : 'hover:bg-element/80'}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-[13px] font-semibold">{shortDateFormatter.format(new Date(tx.date))}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link href={`/stock/${tx.asset.ticker}`} className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-element-hover border border-border flex items-center justify-center overflow-hidden shrink-0 transition-transform group-hover:scale-105">
                              <CachedAssetLogo
                                ticker={tx.asset.ticker}
                                logoUrl={logoMap[tx.asset.ticker]}
                                size={36}
                                loading="eager"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-bold text-primary leading-tight group-hover:underline underline-offset-2 truncate">{tx.asset.ticker}</p>
                              <p className="text-[11px] text-secondary font-medium truncate max-w-[150px] opacity-60">{tx.asset.name}</p>
                              {selectionMode === 'multi' && (
                                <p className="text-[10px] text-secondary/70 font-semibold truncate max-w-[150px]">{tx.portfolio.name}</p>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${tx.type === 'BUY' ? `${colors.gain.tailwind.bgLight} ${colors.gain.tailwind.text}` : tx.type === 'SELL' ? `${colors.loss.tailwind.bgLight} ${colors.loss.tailwind.text}` : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'}`}>
                              {getTransactionTypeLabel(tx.type)}
                            </span>
                            {getTransactionTag(tx) && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                                {getTransactionTag(tx)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums text-[13px] font-semibold">{tx.type === 'DIVIDEND' ? '—' : formatNumber(tx.quantity, locale)}</td>
                        <td className="px-6 py-4 text-right tabular-nums text-[13px] text-secondary font-medium">{tx.type === 'DIVIDEND' ? '—' : fmt(tx.priceUSD || tx.price)}</td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-[14px] font-bold text-primary tabular-nums">{fmt(tx.type === 'DIVIDEND' ? tx.price : (tx.priceUSD || tx.price) * Math.abs(tx.quantity))}</p>
                          {tx.type === 'DIVIDEND' && tx.notes && (
                            <p className="text-[10px] text-secondary/60 font-medium tabular-nums mt-0.5 tracking-tight">
                              {tx.notes
                                .replace(/^(Dividend|Reinvested dividend): /g, '')
                                .replace(/ shares x /g, ' × ')
                                .replace(/ per share/g, '')}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {confirmingId === tx.id ? (
                            <div className="flex items-center justify-center gap-1.5 animate-in fade-in zoom-in-95">
                              <button onClick={() => handleDelete(tx)} className="text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors">{t('confirm')}</button>
                              <button onClick={() => setConfirmingId(null)} className="text-[11px] font-bold text-secondary hover:text-primary transition-colors">{t('cancel')}</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => editingId === tx.id ? closeEdit() : openEdit(tx)} className={`p-1.5 rounded-lg transition-all ${editingId === tx.id ? 'text-primary bg-element' : 'text-secondary hover:text-primary hover:bg-element'}`}>
                                {editingId === tx.id ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => setConfirmingId(tx.id)} className="p-1.5 text-secondary hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50/10">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Edit Row with Animation */}
                      <tr className={editingId === tx.id ? 'bg-element/40' : 'hidden'}>
                        <td colSpan={7} className="p-0 border-t border-border/40">
                          <div className="px-6 py-5 flex items-end justify-between gap-6 animate-in slide-in-from-top-2">
                             <div className="flex items-end gap-6">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">{t('date')}</label>
                                  <input type="date" value={editState?.date} onChange={e => setEditState(s => s ? { ...s, date: e.target.value } : s)} className="h-10 px-3 bg-card rounded-xl text-[13px] font-semibold border border-border focus:border-primary outline-none transition-all" />
                                </div>
                                {tx.type !== 'DIVIDEND' && !isManagedDripTransaction(tx) && (
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">{t('shares')}</label>
                                    <input type="number" step="any" value={editState?.quantity} onChange={e => setEditState(s => s ? { ...s, quantity: e.target.value } : s)} className="h-10 w-32 px-3 bg-card rounded-xl text-[13px] font-semibold border border-border focus:border-primary outline-none transition-all" />
                                  </div>
                                )}
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                                    {tx.type === 'DIVIDEND'
                                      ? t('amount')
                                      : isManagedDripTransaction(tx)
                                        ? 'Reinvest Price'
                                        : t('unitPrice')}
                                  </label>
                                  <input type="number" step="any" value={editState?.price} onChange={e => setEditState(s => s ? { ...s, price: e.target.value } : s)} className="h-10 w-32 px-3 bg-card rounded-xl text-[13px] font-semibold border border-border focus:border-primary outline-none transition-all" />
                                </div>
                             </div>
                             <button onClick={() => handleSave(tx)} disabled={isSaving} className="h-10 px-6 bg-primary text-on-primary rounded-xl text-[13px] font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2">
                               {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                               <span>{t('saveChanges')}</span>
                             </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden divide-y divide-border">
            {filteredTransactions.length === 0 ? (
              <div className="px-6 py-16 text-center text-secondary font-medium"><EmptyState /></div>
            ) : (
              filteredTransactions.map((tx) => (
                <div key={tx.id} className="p-5 flex items-center justify-between group active:bg-element transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-element-hover border border-border flex items-center justify-center overflow-hidden shrink-0">
                      <CachedAssetLogo
                        ticker={tx.asset.ticker}
                        logoUrl={logoMap[tx.asset.ticker]}
                        size={48}
                        loading="eager"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold text-primary truncate leading-tight mb-1">{tx.asset.ticker}</p>
                      <div className="flex items-center gap-2 text-[12px] text-secondary font-medium">
                        <span>{shortDateFormatter.format(new Date(tx.date))}</span>
                        <span className="opacity-30">·</span>
                        <span className="uppercase tracking-wider text-[10px] font-bold text-primary/70">{getTransactionTypeLabel(tx.type)}</span>
                        {getTransactionTag(tx) && (
                          <>
                            <span className="opacity-30">·</span>
                            <span className="uppercase tracking-wider text-[10px] font-bold text-sky-600 dark:text-sky-300">{getTransactionTag(tx)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-bold text-primary tabular-nums leading-tight mb-1">{fmt(tx.type === 'DIVIDEND' ? tx.price : (tx.priceUSD || tx.price) * Math.abs(tx.quantity))}</p>
                    <p className="text-[12px] text-secondary font-medium">
                       {tx.type === 'DIVIDEND' ? 'Payout' : `${formatNumber(tx.quantity, locale)} units`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-10 gap-4">
            <p className="text-[13px] font-medium text-secondary order-2 sm:order-1">
              {t('showing', { from: ((currentPage - 1) * limit) + 1, to: Math.min(currentPage * limit, total), total })}
            </p>
            <div className="flex items-center gap-1 bg-card border border-border p-1 rounded-full shadow-sm order-1 sm:order-2">
              <Link href={toPortfolioSelectionHref('/transactions', effectiveSelectedPortfolioIds, new URLSearchParams({ page: String(currentPage - 1) }))} className={`px-5 py-2 text-[12px] font-bold rounded-full transition-all ${currentPage <= 1 ? 'opacity-20 pointer-events-none' : 'text-secondary hover:text-primary hover:bg-element'}`}>
                Prev
              </Link>
              <div className="w-px h-3 bg-border/60 mx-1" />
              <Link href={toPortfolioSelectionHref('/transactions', effectiveSelectedPortfolioIds, new URLSearchParams({ page: String(currentPage + 1) }))} className={`px-5 py-2 text-[12px] font-bold rounded-full transition-all ${currentPage >= totalPages ? 'opacity-20 pointer-events-none' : 'text-secondary hover:text-primary hover:bg-element'}`}>
                Next
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
