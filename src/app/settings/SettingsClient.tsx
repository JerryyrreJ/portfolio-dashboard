'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usePreferences } from '@/lib/usePreferences';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { 
  ChevronLeft, 
  Wallet, 
  Settings, 
  Bell,
  Download,
  Monitor,
  BarChart2,
  EyeOff,
  Zap,
  ShieldCheck,
  Lock,
  Mail,
  Key,
  TrendingUp,
  FileText,
  UserCircle,
  AlertCircle,
  Loader2,
  Eye,
  LogOut,
  Plus
} from 'lucide-react';
import AuthPanel from '@/app/components/settings/AuthPanel';
import PasskeySection from '@/app/components/settings/PasskeySection';
import { createClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Notification from '@/app/components/Notification';
import ConfirmationModal from '@/app/components/ConfirmationModal';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCurrencySymbol } from '@/lib/currency';

interface SettingsClientProps {
  initialUser: User | null;
  initialPortfolios: PortfolioSummary[];
}

type PortfolioSummary = {
  id: string;
  name: string;
  currency: string;
  settingsUpdatedAt?: string | null;
};

type PortfolioListResponse = {
  portfolios?: PortfolioSummary[];
  error?: string;
};

type PortfolioMutationResponse = {
  portfolio?: PortfolioSummary;
  error?: string;
};

type ExportTransaction = {
  date: string;
  ticker: string;
  name: string;
  market: string;
  type: string;
  quantity: number;
  price: number;
  currency: string;
  fee: number;
  totalValue: string;
  notes: string;
};

type ExportPayload = {
  portfolio: {
    name: string;
    currency: string;
  };
  exportDate: string;
  range: string;
  transactions: ExportTransaction[];
};

type ExportBodyRow = {
  date: string;
  asset: string;
  type: string;
  quantity: string | number;
  price: string;
  fee: string;
  total: string;
  currency: string;
  _isGroupHeader?: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const LEGACY_PORTFOLIO_CACHE_KEY = 'cached_portfolios';

function getPortfolioCacheKey(userId: string) {
  return `cached_portfolios:${userId}`;
}

function loadCachedPortfolios(userId: string): PortfolioSummary[] {
  const raw = localStorage.getItem(getPortfolioCacheKey(userId)) ?? localStorage.getItem(LEGACY_PORTFOLIO_CACHE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PortfolioSummary[] : [];
  } catch {
    return [];
  }
}

function saveCachedPortfolios(userId: string, portfolios: PortfolioSummary[]) {
  const serialized = JSON.stringify(portfolios);
  localStorage.setItem(getPortfolioCacheKey(userId), serialized);
  localStorage.setItem(LEGACY_PORTFOLIO_CACHE_KEY, serialized);
}

function clearCachedPortfolios(userId?: string) {
  localStorage.removeItem(LEGACY_PORTFOLIO_CACHE_KEY);
  if (userId) {
    localStorage.removeItem(getPortfolioCacheKey(userId));
  }
}

interface PortfolioItemProps {
  portfolio: PortfolioSummary;
  isOnlyOne?: boolean;
  isEditing: boolean;
  onUpdate: (id: string, name: string, currency: string, field: 'name' | 'currency' | 'both') => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string) => void;
}

function PortfolioItem({ portfolio, isOnlyOne = false, isEditing, onUpdate, onDelete, onToggle }: PortfolioItemProps) {
  const tPortfolio = useTranslations('settings.portfolio');
  const [name, setName] = useState(portfolio.name);
  const [currency, setCurrency] = useState(portfolio.currency);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setName(portfolio.name);
    setCurrency(portfolio.currency);
  }, [portfolio.currency, portfolio.name]);

  const handleToggle = () => {
    if (!isEditing) {
      // Switch context in URL when opening
      const params = new URLSearchParams(searchParams.toString());
      params.set('pid', portfolio.id);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    } else {
      setName(portfolio.name);
      setCurrency(portfolio.currency);
    }
    onToggle(portfolio.id);
  };

  const handleSave = async (field: 'name' | 'currency') => {
    setLoading(true);
    try {
      await onUpdate(portfolio.id, name, currency, field);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card sm:bg-transparent">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isEditing ? 'scale-110 ring-4 ring-black/5' : ''}`}>
            <Wallet className={`w-4 h-4 transition-colors duration-300 ${isEditing ? 'text-primary' : 'text-secondary'}`} />
          </div>
          <div>
            <div className="text-[14px] font-bold text-primary leading-tight">{portfolio.name}</div>
            <div className="text-[13px] text-secondary font-medium mt-0.5">{portfolio.currency}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleToggle}
            className={`text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-[0.97] border ${
              isEditing 
                ? 'bg-element-hover border-border text-secondary' 
                : 'bg-card border-border text-primary hover:bg-element-hover'
            }`}
          >
            {isEditing ? tPortfolio('cancel') : tPortfolio('edit')}
          </button>
        </div>
      </div>
      
      {/* Expandable Editor */}
      <div className={`grid transition-all duration-300 ease-in-out will-change-[grid-template-rows] ${isEditing ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-5 bg-card border-t border-border/60 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">{tPortfolio('portfolioName')}</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">{tPortfolio('baseCurrency')}</label>
                <select 
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary outline-none transition-all"
                >
                  {['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'SGD', 'CAD', 'AUD'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => handleSave('name')}
                disabled={loading || !name.trim()}
                className="flex-1 bg-primary text-on-primary text-[13px] font-bold py-2.5 rounded-xl hover:bg-primary-hover transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {tPortfolio('updateName')}
              </button>
              <button 
                onClick={() => handleSave('currency')}
                disabled={loading}
                className="flex-1 bg-element-hover text-primary border border-border text-[13px] font-bold py-2.5 rounded-xl hover:bg-element transition-all active:scale-[0.98]"
              >
                {tPortfolio('updateCurrency')}
              </button>
            </div>

            {!isOnlyOne && (
              <div className="pt-2">
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 transition-colors">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-rose-600 dark:text-rose-500">{tPortfolio('dangerZone')}</div>
                      <div className="mt-1 text-[13px] font-medium text-rose-600/80 dark:text-rose-400/80">
                        {tPortfolio('dangerDescription')}
                      </div>
                    </div>
                    <button
                      onClick={() => onDelete(portfolio.id)}
                      className="text-[13px] font-bold px-3 py-2 rounded-xl border border-rose-500/20 bg-card text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 transition-all active:scale-[0.98] sm:flex-shrink-0"
                    >
                      {tPortfolio('deletePortfolio')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsClient({ initialUser, initialPortfolios }: SettingsClientProps) {
  const t = useTranslations('settings');
  const tPortfolio = useTranslations('settings.portfolio');
  const tPreferences = useTranslations('settings.preferences');
  const tNotificationCenter = useTranslations('settings.notificationCenter');
  const tAccount = useTranslations('settings.account');
  const tNotifications = useTranslations('settings.notifications');
  const locale = useLocale();
  const [activeSection, setActiveSection] = useState('portfolio');
  const [user, setUser] = useState<User | null>(initialUser);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPendingLang, startTransition] = useTransition();
  const currentPortfolioId = searchParams.get('pid') ?? '';

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });

  const supabase = createClient();
  const { prefs, updatePreference } = usePreferences();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Display name edit state
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  // Inline edit states
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [portfolioName, setPortfolioName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [portfolioActionLoading, setPortfolioActionLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [allPortfolios, setAllPortfolios] = useState<PortfolioSummary[]>(initialPortfolios);
  const [portfoliosLoading, setPortfoliosLoading] = useState(() => !!initialUser && initialPortfolios.length === 0);
  const [openPortfolioEditorId, setOpenPortfolioEditorId] = useState<string | null>(null);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('USD');
  const [createPortfolioLoading, setCreatePortfolioLoading] = useState(false);

  // Inline edit states for Preferences
  const [openPreferencesEditor, setOpenPreferencesEditor] = useState<'theme' | 'chartType' | 'colorScheme' | 'costBasis' | 'language' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportRange, setExportRange] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportLoading, setExportLoading] = useState(false);
  const longDateFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const sessionDateFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const sessionTimeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const getThemeLabel = (value?: string | null) => {
    if (value === 'light') return tPreferences('themeLight');
    if (value === 'dark') return tPreferences('themeDark');
    return tPreferences('themeSystem');
  };

  const getChartTypeLabel = (value: string) => {
    if (value === 'Area Chart') return tPreferences('chartAreaFull');
    if (value === 'Line Chart') return tPreferences('chartLineFull');
    if (value === 'Bar Chart') return tPreferences('chartBarFull');
    return value;
  };

  const getCostBasisLabel = (value: string) => {
    if (value === 'FIFO') return tPreferences('costBasisFifoDesc');
    if (value === 'AVCO') return tPreferences('costBasisAvcoDesc');
    return value;
  };

  const getExportRangeLabel = (value: string) => {
    if (value === 'ytd') return tPortfolio('rangeYtd');
    if (value === '12m') return tPortfolio('range12m');
    return tPortfolio('rangeAll');
  };

  const handleExport = async () => {
    setExportLoading(true);
    const pidParam = currentPortfolioId ? `&portfolioId=${currentPortfolioId}` : '';
    try {
      if (exportFormat === 'pdf') {
        const response = await fetch(`/api/transactions/export?format=json&range=${exportRange}${pidParam}`);
        if (!response.ok) throw new Error(tNotifications('fetchPdfFailedMessage'));
        const data = await response.json() as ExportPayload;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Dark header bar
        doc.setFillColor(30, 30, 30);
        doc.rect(0, 0, pageWidth, 18, 'F');

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Folio', 14, 12);

        const rangeLabel = exportRange === 'ytd' ? `${tPortfolio('rangeYtd')} ${new Date().getFullYear()}`
          : getExportRangeLabel(exportRange);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(rangeLabel, pageWidth - 14, 12, { align: 'right' });

        // Sub-header
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(`${data.portfolio.name}  ·  ${data.portfolio.currency}`, 14, 26);
        doc.text(longDateFormatter.format(new Date()), pageWidth - 14, 26, { align: 'right' });

        // Separator
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(14, 29, pageWidth - 14, 29);

        let currentY = 36;

        // Summary stat boxes
        const totalCount = data.transactions.length;
        const totalBuy = data.transactions.filter((t) => t.type === 'BUY').reduce((s, t) => s + parseFloat(t.totalValue), 0);
        const totalSell = data.transactions.filter((t) => t.type === 'SELL').reduce((s, t) => s + parseFloat(t.totalValue), 0);
        const portfolioSym = getCurrencySymbol(data.portfolio.currency);

        const statBoxes = [
          { label: 'Transactions', value: String(totalCount) },
          { label: 'Total Bought', value: `${portfolioSym}${totalBuy.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Total Sold',   value: `${portfolioSym}${totalSell.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        ];
        const boxWidth = (pageWidth - 28) / 3;

        statBoxes.forEach((box, i) => {
          const x = 14 + i * boxWidth;
          doc.setFillColor(248, 248, 248);
          doc.roundedRect(x, currentY, boxWidth - 3, 16, 1, 1, 'F');
          doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
          doc.text(box.label.toUpperCase(), x + 4, currentY + 5.5);
          doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
          doc.text(box.value, x + 4, currentY + 13);
        });

        currentY += 22;

        // Group transactions by market
        const grouped = data.transactions.reduce<Record<string, ExportTransaction[]>>((acc, t) => {
          const key = t.market || 'OTHER';
          if (!acc[key]) acc[key] = [];
          acc[key].push(t);
          return acc;
        }, {});
        const marketOrder = Object.keys(grouped).sort();

        // Build table columns and body rows
        const columns = [
          { header: 'Date',     dataKey: 'date'     },
          { header: 'Asset',    dataKey: 'asset'    },
          { header: 'Type',     dataKey: 'type'     },
          { header: 'Qty',      dataKey: 'quantity' },
          { header: 'Price',    dataKey: 'price'    },
          { header: 'Fee',      dataKey: 'fee'      },
          { header: 'Total',    dataKey: 'total'    },
          { header: 'Ccy',      dataKey: 'currency' },
        ];

        const bodyRows: ExportBodyRow[] = [];
        for (const market of marketOrder) {
          bodyRows.push({ date: market, asset: '', type: '', quantity: '', price: '', fee: '', total: '', currency: '', _isGroupHeader: true });
          for (const t of grouped[market]) {
            const tsym = getCurrencySymbol(t.currency || 'USD');
            bodyRows.push({
              date:     t.date,
              asset:    `${t.ticker}\n${t.name}`,
              type:     t.type,
              quantity: t.quantity,
              price:    `${tsym}${Number(t.price).toFixed(2)}`,
              fee:      `${tsym}${Number(t.fee).toFixed(2)}`,
              total:    `${tsym}${parseFloat(t.totalValue).toFixed(2)}`,
              currency: t.currency || 'USD',
            });
          }
        }

        autoTable(doc, {
          startY: currentY,
          columns,
          body: bodyRows,
          theme: 'plain',
          headStyles: { fillColor: [240, 240, 240], textColor: 60, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
          bodyStyles: { fontSize: 8, cellPadding: 4, textColor: 40 },
          alternateRowStyles: { fillColor: [252, 252, 252] },
          styles: { font: 'helvetica', lineColor: [235, 235, 235], lineWidth: 0.1, overflow: 'linebreak' },
          columnStyles: {
            date:     { cellWidth: 22 },
            asset:    { cellWidth: 42 },
            type:     { cellWidth: 16 },
            quantity: { cellWidth: 18, halign: 'right' },
            price:    { cellWidth: 24, halign: 'right' },
            fee:      { cellWidth: 20, halign: 'right' },
            total:    { cellWidth: 28, halign: 'right' },
            currency: { cellWidth: 18, halign: 'center' },
          },
          margin: { top: 20, bottom: 16 },
          didParseCell(data) {
            const raw = data.row.raw as ExportBodyRow | undefined;
            if (raw?._isGroupHeader) {
              data.cell.styles.fillColor = [235, 240, 248];
              data.cell.styles.textColor = [40, 80, 140];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 8;
              if (data.column.dataKey !== 'date') data.cell.text = [''];
            }
          },
        });

        // Post-pass footer with correct "Page X of Y"
        const totalPages = doc.getNumberOfPages();
        const genTime = new Date().toLocaleString();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          const footerY = doc.internal.pageSize.getHeight() - 8;
          doc.setFillColor(255, 255, 255);
          doc.rect(0, footerY - 5, pageWidth, 12, 'F');
          doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
          doc.text(genTime, 14, footerY);
          doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, footerY, { align: 'right' });
          doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2);
          doc.line(14, footerY - 3, pageWidth - 14, footerY - 3);
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        doc.save(`folio_report_${data.portfolio.name.replace(/\s+/g, '_')}_${exportRange}_${dateStr}.pdf`);
        showNotification('success', tNotifications('pdfDownloadedTitle'), tNotifications('pdfDownloadedMessage'));
        setIsExporting(false);
      } else {
        const response = await fetch(`/api/transactions/export?format=${exportFormat}&range=${exportRange}${pidParam}`);
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio_transactions_${exportRange}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('success', tNotifications('exportCompleteTitle'), tNotifications('exportCompleteMessage', { format: exportFormat.toUpperCase() }));
        setIsExporting(false);
      }
    } catch (error: unknown) {
      showNotification('error', tNotifications('exportFailedTitle'), getErrorMessage(error, tNotifications('exportFailedMessage')));
    } finally {
      setExportLoading(false);
    }
  };

  // Global Notification State
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'loading';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showNotification = (type: 'success' | 'error' | 'loading', title: string, message: string) => {
    setNotification({ show: true, type, title, message });
  };

  useEffect(() => {
    if (user) {
      const selectedPortfolio = currentPortfolioId
        ? allPortfolios.find((portfolio) => portfolio.id === currentPortfolioId)
        : allPortfolios[0];

      if (allPortfolios.length > 0 || !portfoliosLoading) {
        saveCachedPortfolios(user.id, allPortfolios);
      }

      if (selectedPortfolio) {
        const nextName = selectedPortfolio.name || '';
        const nextCurrency = selectedPortfolio.currency || 'USD';

        setPortfolioName(nextName);
        setBaseCurrency(nextCurrency);
        localStorage.setItem('portfolio_name', nextName);
        localStorage.setItem('base_currency', nextCurrency);

        if (selectedPortfolio.settingsUpdatedAt) {
          localStorage.setItem('settings_updated_at', selectedPortfolio.settingsUpdatedAt);
        }
      }
    } else {
      const cachedName = localStorage.getItem('portfolio_name');
      const cachedCurrency = localStorage.getItem('base_currency');

      setPortfolioName(cachedName ?? '');
      setBaseCurrency(cachedCurrency ?? 'USD');
    }
  }, [allPortfolios, currentPortfolioId, portfoliosLoading, user]);

  useEffect(() => {
    let cancelled = false;

    const syncPortfolios = async () => {
      if (!user) {
        setAllPortfolios([]);
        setPortfoliosLoading(false);
        return;
      }

      const cached = loadCachedPortfolios(user.id);
      if (cached.length > 0) {
        setAllPortfolios(cached);
        setPortfoliosLoading(false);
      } else {
        setPortfoliosLoading(true);
      }

      try {
        const response = await fetch('/api/portfolio', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load portfolios');

        const payload = await response.json() as PortfolioListResponse;
        let cloudPortfolios = Array.isArray(payload.portfolios) ? payload.portfolios : [];

        if (cloudPortfolios.length === 0) {
          const createResponse = await fetch('/api/portfolio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'My Portfolio', currency: 'USD' }),
          });

          if (createResponse.ok) {
            const createPayload = await createResponse.json() as PortfolioMutationResponse;
            cloudPortfolios = createPayload.portfolio ? [createPayload.portfolio] : [];
          }
        }

        const localById = new Map(cached.map((portfolio) => [portfolio.id, portfolio]));
        const mergedPortfolios = [...cloudPortfolios];

        await Promise.all(cloudPortfolios.map(async (cloudPortfolio) => {
          const localPortfolio = localById.get(cloudPortfolio.id);
          if (!localPortfolio) return;

          const localMs = localPortfolio.settingsUpdatedAt ? new Date(localPortfolio.settingsUpdatedAt).getTime() : 0;
          const cloudMs = cloudPortfolio.settingsUpdatedAt ? new Date(cloudPortfolio.settingsUpdatedAt).getTime() : 0;

          if (localMs > cloudMs && (
            localPortfolio.name !== cloudPortfolio.name ||
            localPortfolio.currency !== cloudPortfolio.currency
          )) {
            const patchResponse = await fetch(`/api/portfolio?id=${cloudPortfolio.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: localPortfolio.name,
                currency: localPortfolio.currency,
              }),
            });

            if (patchResponse.ok) {
              const patchPayload = await patchResponse.json() as PortfolioMutationResponse;
              if (patchPayload.portfolio) {
                const index = mergedPortfolios.findIndex((portfolio) => portfolio.id === cloudPortfolio.id);
                if (index >= 0) {
                  mergedPortfolios[index] = patchPayload.portfolio;
                }
              }
            }
          }
        }));

        if (!cancelled) {
          setAllPortfolios(mergedPortfolios);
          saveCachedPortfolios(user.id, mergedPortfolios);
          setPortfoliosLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPortfoliosLoading(false);
        }
      }
    };

    syncPortfolios();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const previousUserId = user?.id;
      setUser(session?.user ?? null);
      if (!session?.user) {
        clearCachedPortfolios(previousUserId);
        localStorage.removeItem('portfolio_name');
        localStorage.removeItem('base_currency');
        localStorage.removeItem('settings_updated_at');
        localStorage.removeItem('passkey_credentials');
        setPortfolioName('');
        setBaseCurrency('USD');
        setAllPortfolios([]);
        setPortfoliosLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, user?.id]);

  const isLoggedIn = !!user;

  // Refs for smooth scrolling and intersection observation
  const accountRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLDivElement>(null);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const navItems = React.useMemo(() => [
    { id: 'portfolio', name: t('navigation.portfolio'), icon: <Wallet className="w-4 h-4" />, ref: portfolioRef },
    { id: 'preferences', name: t('navigation.preferences'), icon: <Settings className="w-4 h-4" />, ref: preferencesRef },
    { id: 'notifications', name: t('navigation.notifications'), icon: <Bell className="w-4 h-4" />, ref: notificationsRef },
    { id: 'account', name: t('navigation.account'), icon: <UserCircle className="w-4 h-4" />, ref: accountRef },
  ], [t]);

  const handleSignOut = async () => {
    clearCachedPortfolios(user?.id);
    await supabase.auth.signOut();
  };

  const handleUpdatePortfolio = async (id: string, newName: string, newCurrency: string, field: 'name' | 'currency' | 'both') => {
    if (!isLoggedIn) {
      const now = new Date().toISOString();
      if (field === 'name' || field === 'both') {
        localStorage.setItem('portfolio_name', newName);
        setPortfolioName(newName);
      }
      if (field === 'currency' || field === 'both') {
        localStorage.setItem('base_currency', newCurrency);
        setBaseCurrency(newCurrency);
      }
      localStorage.setItem('settings_updated_at', now);
      
      const msg = field === 'both'
        ? tPortfolio('localSettingsSaved')
        : field === 'name'
          ? tPortfolio('localNameSaved')
          : tPortfolio('localCurrencySaved');
      showNotification('success', tNotifications('settingsSavedTitle'), msg);
      return;
    }

    setPortfolioActionLoading(true);
    setPortfolioError(null);

    const previousPortfolios = allPortfolios;
    const now = new Date().toISOString();
    const optimisticPortfolios = allPortfolios.map((portfolio) => portfolio.id === id ? {
      ...portfolio,
      name: field === 'currency' ? portfolio.name : newName,
      currency: field === 'name' ? portfolio.currency : newCurrency,
      settingsUpdatedAt: now,
    } : portfolio);

    setAllPortfolios(optimisticPortfolios);
    if (user?.id) {
      saveCachedPortfolios(user.id, optimisticPortfolios);
    }

    try {
      const payload = field === 'name' ? { name: newName } : field === 'currency' ? { currency: newCurrency } : { name: newName, currency: newCurrency };
      const res = await fetch(`/api/portfolio?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.portfolio) {
          const updatedPortfolios = optimisticPortfolios.map((p) => p.id === data.portfolio.id ? data.portfolio : p);
          setAllPortfolios(updatedPortfolios);
          if (user?.id) {
            saveCachedPortfolios(user.id, updatedPortfolios);
          }
        }
      }

      showNotification('success', tNotifications('settingsSavedTitle'), tNotifications('settingsSavedMessage'));
      if (id === currentPortfolioId || (!currentPortfolioId && id === allPortfolios[0]?.id)) {
        localStorage.setItem('portfolio_name', newName);
        localStorage.setItem('base_currency', newCurrency);
        setPortfolioName(newName);
        setBaseCurrency(newCurrency);
      }
      localStorage.setItem('settings_updated_at', now);
    } catch (err: unknown) {
      setAllPortfolios(previousPortfolios);
      if (user?.id) {
        saveCachedPortfolios(user.id, previousPortfolios);
      }
      const message = getErrorMessage(err, tNotifications('updateFailedMessage'));
      setPortfolioError(message);
      showNotification('error', tNotifications('updateFailedTitle'), message || tNotifications('updateFailedMessage'));
    } finally {
      setPortfolioActionLoading(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    if (allPortfolios.length <= 1) {
      showNotification('error', tNotifications('cannotDeleteTitle'), tNotifications('cannotDeleteMessage'));
      return;
    }
    
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    const id = deleteConfirm.id;

    setPortfolioActionLoading(true);
    const previousPortfolios = allPortfolios;
    const remaining = allPortfolios.filter((p) => p.id !== id);
    setAllPortfolios(remaining);
    if (openPortfolioEditorId === id) {
      setOpenPortfolioEditorId(null);
    }
    if (user?.id) {
      saveCachedPortfolios(user.id, remaining);
    }
    try {
      const res = await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || tNotifications('deleteFailedMessage'));
      }

      showNotification('success', tNotifications('portfolioDeletedTitle'), tNotifications('portfolioDeletedMessage'));
      
      if (id === currentPortfolioId) {
        router.push('/settings');
      }
    } catch (err: unknown) {
      setAllPortfolios(previousPortfolios);
      if (user?.id) {
        saveCachedPortfolios(user.id, previousPortfolios);
      }
      showNotification('error', tNotifications('deleteFailedTitle'), getErrorMessage(err, tNotifications('deleteFailedMessage')));
    } finally {
      setPortfolioActionLoading(false);
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const togglePortfolioEditor = (id: string) => {
    setIsCreatingPortfolio(false);
    setIsExporting(false);
    setOpenPortfolioEditorId((currentId) => currentId === id ? null : id);
  };

  const toggleCreatePortfolio = () => {
    setOpenPortfolioEditorId(null);
    setIsExporting(false);
    setIsCreatingPortfolio((prev) => !prev);
    setPortfolioError(null);
  };

  const toggleExportDrawer = () => {
    setOpenPortfolioEditorId(null);
    setIsCreatingPortfolio(false);
    setIsExporting((prev) => !prev);
  };

  const handleCreatePortfolio = async () => {
    if (!newPortfolioName.trim() || createPortfolioLoading) return;

    setCreatePortfolioLoading(true);
    setPortfolioError(null);

    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPortfolioName.trim(),
          currency: newPortfolioCurrency,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || tNotifications('createFailedMessage'));
      }

      const { portfolio } = await res.json();
      const nextPortfolios = [...allPortfolios, portfolio];
      setAllPortfolios(nextPortfolios);
      if (user?.id) {
        saveCachedPortfolios(user.id, nextPortfolios);
      }
      setNewPortfolioName('');
      setNewPortfolioCurrency('USD');
      setIsCreatingPortfolio(false);
      showNotification('success', tNotifications('portfolioCreatedTitle'), tNotifications('portfolioCreatedMessage'));
      router.push(`/settings?pid=${portfolio.id}#portfolio`);
    } catch (err: unknown) {
      const message = getErrorMessage(err, tNotifications('createFailedMessage'));
      setPortfolioError(message);
      showNotification('error', tNotifications('createFailedTitle'), message || tNotifications('createFailedMessage'));
    } finally {
      setCreatePortfolioLoading(false);
    }
  };

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDisplayName.trim();
    if (!trimmed || trimmed === (user?.user_metadata?.display_name || user?.email?.split('@')[0])) return;
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
      if (error) throw error;
      setUser(data.user);
      setIsEditingDisplayName(false);
      showNotification('success', tNotifications('nameUpdatedTitle'), tNotifications('nameUpdatedMessage'));
    } catch (err: unknown) {
      const message = getErrorMessage(err, tNotifications('nameUpdateFailedMessage'));
      setAuthError(message);
      showNotification('error', tNotifications('updateFailedTitle'), message || tNotifications('nameUpdateFailedMessage'));
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === user?.email) return;
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      showNotification('success', tNotifications('verificationSentTitle'), tNotifications('verificationSentMessage'));
      setIsEditingEmail(false);
    } catch (err: unknown) {
      const message = getErrorMessage(err, tNotifications('emailUpdateFailedMessage'));
      setAuthError(message);
      showNotification('error', tNotifications('updateFailedTitle'), message || tNotifications('emailUpdateFailedMessage'));
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      setAuthError(tAccount('passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 6) {
      setAuthError(tAccount('passwordMinLength'));
      return;
    }
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showNotification('success', tNotifications('passwordUpdatedTitle'), tNotifications('passwordUpdatedMessage'));
      setIsEditingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = getErrorMessage(err, tNotifications('passwordUpdateFailedMessage'));
      setAuthError(message);
      showNotification('error', tNotifications('updateFailedTitle'), message || tNotifications('passwordUpdateFailedMessage'));
    } finally {
      setAuthActionLoading(false);
    }
  };

  // Intersection Observer to update active nav item based on scroll position
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px', // Trigger when section is near top third of screen
      threshold: 0
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    navItems.forEach(item => {
      if (item.ref.current) observer.observe(item.ref.current);
    });

    return () => observer.disconnect();
  }, [navItems]);

  const scrollToSection = (id: string, ref: React.RefObject<HTMLDivElement | null>) => {
    setActiveSection(id);
    if (ref.current) {
      // Offset for the sticky header
      const yOffset = -100; 
      const element = ref.current;
      const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
      
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const renderToggle = (enabled: boolean = false) => (
    <button className={`w-10 h-5 ${enabled ? 'bg-primary' : 'bg-element shadow-inner'} rounded-full relative transition-all border border-border/50`}>
      <div className={`absolute ${enabled ? 'left-[22px]' : 'left-0.5'} top-0.5 w-4 h-4 bg-white dark:bg-zinc-100 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-all`}></div>
    </button>
  );

  return (
    <div className="min-h-screen bg-page text-primary font-sans antialiased flex flex-col">
      <Notification 
        show={notification.show} 
        type={notification.type} 
        title={notification.title} 
        message={notification.message} 
        onClose={() => setNotification({ ...notification, show: false })} 
      />
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border px-4 sm:px-6 h-[56px] flex items-center sticky top-0 z-50 transition-all">
        <Link href="/app" className="flex items-center space-x-2 text-[14px] font-semibold text-secondary hover:text-primary transition-colors group">
          <div className="w-6 h-6 rounded-full bg-element-hover flex items-center justify-center group-hover:bg-gray-200 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 text-secondary group-hover:text-primary" />
          </div>
          <span>{t('backToDashboard')}</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full py-6 md:py-12 flex flex-col md:flex-row justify-center items-start px-4 sm:px-6 gap-8 md:gap-12 relative">
        
        {/* Sidebar Navigation - Hidden on Mobile */}
        <aside className="hidden md:block w-64 flex-shrink-0 md:sticky md:top-28">
          <h1 className="text-[24px] md:text-[28px] font-bold text-primary tracking-tight mb-6 md:mb-8 pl-4">{t('title')}</h1>
          <nav className="flex flex-col space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button 
                  key={item.id}
                  onClick={() => scrollToSection(item.id, item.ref)}
                  className={`flex items-center space-x-3 px-4 py-3.5 rounded-[14px] text-[14px] font-semibold transition-all group w-full text-left ${
                    isActive 
                      ? 'bg-card shadow-sm text-primary border border-border/50' 
                      : 'text-secondary hover:bg-element-hover/50 hover:text-primary border border-transparent'
                  }`}
                >
                  <div className={`${isActive ? 'text-primary' : 'text-secondary group-hover:text-secondary'} transition-colors`}>
                    {item.icon}
                  </div>
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area - Scrollable */}
        <div className="w-full max-w-[720px] pb-32">
          {/* Mobile Title - Only visible on small screens */}
          <div className="md:hidden mb-8 px-1">
            <h1 className="text-[32px] font-bold text-primary tracking-tight">{t('title')}</h1>
          </div>
          
          {/* SECTION: PORTFOLIO */}
          <div id="portfolio" ref={portfolioRef} className="scroll-mt-24 md:scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">{tPortfolio('managementTitle')}</h2>
              <p className="text-[13px] text-secondary font-medium mt-1">{tPortfolio('managementDescription')}</p>
            </div>
            
            <div className="space-y-6 bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border mb-12 md:mb-16">
              {/* Portfolios Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tPortfolio('portfoliosTitle')}</h3>
                {isLoggedIn ? (
                  <div className="bg-element/50 rounded-2xl border border-border overflow-hidden transition-all duration-300">
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className={`w-8 h-8 min-w-8 shrink-0 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isCreatingPortfolio ? 'scale-110 ring-4 ring-black/5' : ''}`}>
                          <Plus className={`w-4 h-4 transition-colors duration-300 ${isCreatingPortfolio ? 'text-primary' : 'text-secondary'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-bold text-primary leading-tight">{tPortfolio('createPortfolio')}</div>
                        </div>
                      </div>
                      <button
                        onClick={toggleCreatePortfolio}
                        className={`flex-shrink-0 text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-[0.97] border ${
                          isCreatingPortfolio
                            ? 'bg-element-hover border-border text-secondary'
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {isCreatingPortfolio ? t('actions.cancel') : t('actions.create')}
                      </button>
                    </div>

                    <div className={`grid transition-all duration-300 ease-in-out ${isCreatingPortfolio ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-5 bg-card border-t border-border/60 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">{tPortfolio('portfolioName')}</label>
                              <input
                                type="text"
                                value={newPortfolioName}
                                onChange={(e) => setNewPortfolioName(e.target.value)}
                                placeholder={tPortfolio('createPortfolioPlaceholder')}
                                className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary outline-none transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">{tPortfolio('baseCurrency')}</label>
                              <select
                                value={newPortfolioCurrency}
                                onChange={(e) => setNewPortfolioCurrency(e.target.value)}
                                className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary outline-none transition-all"
                              >
                                {['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'SGD', 'CAD', 'AUD'].map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {portfolioError && (
                            <p className="text-[12px] text-rose-500 font-medium">{portfolioError}</p>
                          )}
                          <button
                            onClick={handleCreatePortfolio}
                            disabled={!newPortfolioName.trim() || createPortfolioLoading}
                            className="w-full bg-primary text-on-primary text-[13px] font-bold py-2.5 rounded-xl hover:bg-primary-hover transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {createPortfolioLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {tPortfolio('createPortfolio')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden transition-all duration-300">
                  {isLoggedIn && portfoliosLoading && allPortfolios.length === 0 ? (
                    <div className="divide-y divide-border/60">
                      {[1, 2].map((index) => (
                        <div key={index} className="px-5 py-4 flex items-center justify-between bg-card sm:bg-transparent animate-pulse">
                          <div className="flex items-center space-x-4 min-w-0">
                            <div className="w-8 h-8 min-w-8 shrink-0 rounded-lg bg-card border border-border shadow-sm" />
                            <div className="min-w-0">
                              <div className="h-4 w-24 bg-border rounded mb-2" />
                              <div className="h-3 w-12 bg-border rounded" />
                            </div>
                          </div>
                          <div className="h-8 w-12 bg-border rounded-lg" />
                        </div>
                      ))}
                    </div>
                  ) : !isLoggedIn ? (
                    /* Guest Mode - Show single local portfolio component */
                    <PortfolioItem 
                      portfolio={{ id: 'local', name: portfolioName, currency: baseCurrency }}
                      isOnlyOne={true}
                      isEditing={openPortfolioEditorId === 'local'}
                      onUpdate={(id, n, c, f) => handleUpdatePortfolio(id, n, c, f)}
                      onDelete={async () => {}} // Guest can't delete
                      onToggle={togglePortfolioEditor}
                    />
                  ) : (
                    /* Logged In - List all portfolios */
                    <div className="divide-y divide-border/60">
                      {allPortfolios.map((p) => (
                        <PortfolioItem 
                          key={p.id}
                          portfolio={p}
                          isOnlyOne={allPortfolios.length <= 1}
                          isEditing={openPortfolioEditorId === p.id}
                          onUpdate={handleUpdatePortfolio}
                          onDelete={handleDeletePortfolio}
                          onToggle={togglePortfolioEditor}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Data Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tPortfolio('dataManagementTitle')}</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between group/item transition-colors duration-300 gap-3">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className={`w-8 h-8 min-w-8 shrink-0 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isExporting ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                        <Download className={`w-4 h-4 transition-colors duration-300 ${isExporting ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-[14px] font-bold text-primary leading-tight truncate">{tPortfolio('exportData')}</div>
                      </div>
                    </div>
                    <button 
                      onClick={toggleExportDrawer}
                      className={`flex-shrink-0 text-[13px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 border ${
                        isExporting
                          ? 'bg-element-hover border-border text-secondary'
                          : 'bg-card border-border text-primary hover:bg-element-hover'
                      }`}
                    >
                      {isExporting ? t('actions.cancel') : tPortfolio('exportData')}
                    </button>
                  </div>

                  {/* Expandable Export Drawer */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isExporting ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="p-5 bg-card border-t border-border/60 space-y-6">
                        {/* Range Selection */}
                        <div className="space-y-3">
                          <label className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em]">{tPortfolio('timeRange')}</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                            {[
                              { id: 'all', label: tPortfolio('rangeAll') },
                              { id: 'ytd', label: tPortfolio('rangeYtd') },
                              { id: '12m', label: tPortfolio('range12m') }
                            ].map((range) => (
                              <button
                                key={range.id}
                                onClick={() => setExportRange(range.id)}
                                className={`px-4 py-3 sm:py-2 rounded-xl border text-[13px] sm:text-[12px] font-bold transition-all active:scale-[0.98] ${
                                  exportRange === range.id
                                    ? 'border-primary bg-primary text-on-primary shadow-sm'
                                    : 'border-border bg-card text-secondary hover:border-border hover:bg-element'
                                }`}
                              >
                                {range.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Format Selection */}
                        <div className="space-y-3">
                          <label className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em]">{tPortfolio('fileFormat')}</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                            {[
                              { id: 'csv', label: 'CSV', sub: tPortfolio('formatCsvSub') },
                              { id: 'json', label: 'JSON', sub: tPortfolio('formatJsonSub') },
                              { id: 'pdf', label: 'PDF', sub: tPortfolio('formatPdfSub') }
                            ].map((format) => (
                              <button
                                key={format.id}
                                onClick={() => setExportFormat(format.id)}
                                className={`px-4 py-3 sm:py-2 rounded-xl border transition-all flex sm:flex-col items-center justify-between sm:justify-center gap-1 sm:gap-0.5 active:scale-[0.98] ${
                                  exportFormat === format.id
                                    ? 'border-primary bg-primary text-on-primary shadow-sm'
                                    : 'border-border bg-card text-secondary hover:border-border hover:bg-element'
                                }`}
                              >
                                <span className="text-[13px] sm:text-[12px] font-bold">{format.label}</span>
                                <span className={`text-[11px] sm:text-[9px] font-medium ${exportFormat === format.id ? 'text-secondary' : 'text-secondary'}`}>{format.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={handleExport}
                          disabled={exportLoading}
                          className="w-full bg-primary text-on-primary text-[13px] font-bold py-2.5 rounded-xl hover:bg-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                        >
                          {exportLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t('actions.preparing')}</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span>{t('actions.downloadFormat', { format: exportFormat.toUpperCase() })}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: PREFERENCES */}
          <div id="preferences" ref={preferencesRef} className="scroll-mt-24 md:scroll-mt-32">
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">{tPreferences('title')}</h2>
            </div>
            
            <div className="space-y-6 bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border mb-12 md:mb-16">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tPreferences('appearance')}</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  {/* Theme Row */}
                  <div className="border-b border-border bg-card sm:bg-transparent">
                    <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                      <div className="flex items-center space-x-3 md:space-x-4">
                        <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${openPreferencesEditor === 'theme' ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                          <Monitor className={`w-4 h-4 transition-colors duration-300 ${openPreferencesEditor === 'theme' ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-primary leading-tight">{tPreferences('theme')}</div>
                          <div className="text-[13px] text-secondary font-medium mt-0.5">
                            {mounted ? getThemeLabel(theme) : tPreferences('themeSystem')}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setOpenPreferencesEditor((current) => current === 'theme' ? null : 'theme');
                        }}
                        className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 border ${
                          openPreferencesEditor === 'theme'
                            ? 'bg-element-hover border-border text-secondary' 
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {openPreferencesEditor === 'theme' ? t('actions.cancel') : t('actions.select')}
                      </button>
                    </div>
                    {/* Expandable Theme Drawer */}
                    <div className={`grid transition-all duration-300 ease-in-out ${openPreferencesEditor === 'theme' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-4 md:p-5 bg-card/50 border-t border-border/60 flex flex-wrap gap-2">
                          <div className="flex w-full bg-element/50 p-1 rounded-2xl gap-1">
                            {[
                              { id: 'Light', label: tPreferences('themeLight') },
                              { id: 'Dark', label: tPreferences('themeDark') },
                              { id: 'System', label: tPreferences('themeSystem') },
                            ].map((themeOption) => {
                              const isSelected = mounted && theme === themeOption.id.toLowerCase();
                              return (
                                <button
                                  key={themeOption.id}
                                  onClick={() => {
                                    setTheme(themeOption.id.toLowerCase());
                                    updatePreference('theme', themeOption.id as 'Light' | 'Dark' | 'System');
                                    setOpenPreferencesEditor(null);
                                  }}
                                  className={`flex-1 text-[12px] font-bold py-2 rounded-xl transition-all active:scale-95 ${
                                    isSelected
                                      ? 'bg-white dark:bg-zinc-100 text-black shadow-[0_2px_10px_-3px_rgba(0,0,0,0.3)]'
                                      : 'text-secondary hover:text-primary'
                                  }`}
                                >
                                  {themeOption.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Market Colors Row */}
                  <div className="border-b border-border bg-card sm:bg-transparent">
                    <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                      <div className="flex items-center space-x-3 md:space-x-4">
                        <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${openPreferencesEditor === 'colorScheme' ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                          <TrendingUp className={`w-4 h-4 transition-colors duration-300 ${openPreferencesEditor === 'colorScheme' ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-primary leading-tight">{tPreferences('marketColors')}</div>
                          <div className="text-[13px] text-secondary font-medium mt-0.5">
                            {prefs.colorScheme === 'Emerald'
                              ? tPreferences('marketColorsEmeraldSummary')
                              : tPreferences('marketColorsRoseSummary')}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setOpenPreferencesEditor((current) => current === 'colorScheme' ? null : 'colorScheme');
                        }}
                        className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                          openPreferencesEditor === 'colorScheme'
                            ? 'bg-element-hover border-border text-secondary' 
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {openPreferencesEditor === 'colorScheme' ? t('actions.cancel') : t('actions.change')}
                      </button>
                    </div>
                    {/* Expandable Color Scheme Drawer */}
                    <div className={`grid transition-all duration-300 ease-in-out ${openPreferencesEditor === 'colorScheme' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-4 md:p-5 bg-card border-t border-border/60 flex flex-col space-y-2">
                          {[
                            { id: 'Emerald', label: tPreferences('marketColorsEmeraldLabel'), desc: tPreferences('marketColorsEmeraldDesc') },
                            { id: 'Rose', label: tPreferences('marketColorsRoseLabel'), desc: tPreferences('marketColorsRoseDesc') }
                          ].map((scheme) => (
                            <button
                              key={scheme.id}
                              onClick={() => {
                                updatePreference('colorScheme', scheme.id as 'Emerald' | 'Rose');
                                setOpenPreferencesEditor(null);
                              }}
                              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98] border ${
                                prefs.colorScheme === scheme.id
                                  ? 'bg-primary border-primary text-on-primary shadow-sm'
                                  : 'bg-element border-border text-primary hover:border-border hover:bg-element-hover'
                              }`}
                            >
                              <div className="flex flex-col items-start">
                                <span className="text-[13px] font-bold">{scheme.label}</span>
                                <span className={`text-[11px] font-medium ${prefs.colorScheme === scheme.id ? 'text-secondary' : 'text-secondary'}`}>
                                  {scheme.desc}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <div className={`w-2.5 h-2.5 rounded-full ${scheme.id === 'Emerald' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                <div className={`w-2.5 h-2.5 rounded-full ${scheme.id === 'Emerald' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chart Type Row */}
                  <div className="border-b border-border bg-card sm:bg-transparent">
                    <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                      <div className="flex items-center space-x-3 md:space-x-4">
                        <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${openPreferencesEditor === 'chartType' ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                          <BarChart2 className={`w-4 h-4 transition-colors duration-300 ${openPreferencesEditor === 'chartType' ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-primary leading-tight">{tPreferences('defaultChartType')}</div>
                          <div className="text-[13px] text-secondary font-medium mt-0.5">{getChartTypeLabel(prefs.chartType)}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setOpenPreferencesEditor((current) => current === 'chartType' ? null : 'chartType');
                        }}
                        className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                          openPreferencesEditor === 'chartType'
                            ? 'bg-element-hover border-border text-secondary' 
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {openPreferencesEditor === 'chartType' ? t('actions.cancel') : t('actions.switch')}
                      </button>
                    </div>
                    {/* Expandable Chart Type Drawer */}
                    <div className={`grid transition-all duration-300 ease-in-out ${openPreferencesEditor === 'chartType' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-4 md:p-5 bg-card/50 border-t border-border/60 flex flex-wrap gap-2">
                          <div className="flex w-full bg-element/50 p-1 rounded-2xl gap-1">
                            {[
                              { id: 'Area', label: tPreferences('chartArea') },
                              { id: 'Line', label: tPreferences('chartLine') },
                              { id: 'Bar', label: tPreferences('chartBar') },
                            ].map((chartOption) => {
                              const isSelected = prefs.chartType.startsWith(chartOption.id);
                              return (
                                <button
                                  key={chartOption.id}
                                  onClick={() => {
                                    updatePreference('chartType', `${chartOption.id} Chart` as 'Area Chart' | 'Line Chart' | 'Bar Chart');
                                    setOpenPreferencesEditor(null);
                                  }}
                                  className={`flex-1 text-[12px] font-bold py-2 rounded-xl transition-all active:scale-95 ${
                                    isSelected
                                      ? 'bg-white dark:bg-zinc-100 text-black shadow-sm'
                                      : 'text-secondary hover:text-primary'
                                  }`}
                                >
                                  {chartOption.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Row: Hide Small Balances */}
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 group-hover/item:scale-110 group-hover/item:ring-4 group-hover/item:ring-black/5">
                        <EyeOff className="w-4 h-4 text-secondary transition-colors group-hover/item:text-primary" />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">{tPreferences('hideSmallBalances')}</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">{tPreferences('hideSmallBalancesDesc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => updatePreference('hideSmallBalances', !prefs.hideSmallBalances)}
                      className={`w-10 h-5 ${prefs.hideSmallBalances ? 'bg-primary' : 'bg-element shadow-inner'} rounded-full relative transition-all active:scale-90 border border-border/50`}
                    >
                      <div className={`absolute ${prefs.hideSmallBalances ? 'left-[22px]' : 'left-0.5'} top-0.5 w-4 h-4 bg-white dark:bg-zinc-100 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-all`}></div>
                    </button>

                  </div>
                </div>
              </div>

              {/* General Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tPreferences('general', { defaultMessage: 'General' })}</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  {/* Language Row */}
                  <div className="border-b border-border bg-card sm:bg-transparent">
                    <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                      <div className="flex items-center space-x-3 md:space-x-4">
                        <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${openPreferencesEditor === 'language' ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                          <Monitor className={`w-4 h-4 transition-colors duration-300 ${openPreferencesEditor === 'language' ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-primary leading-tight">{tPreferences('language', { defaultMessage: 'Language' })}</div>
                          <div className="text-[13px] text-secondary font-medium mt-0.5">{locale === 'zh-CN' ? '中文' : 'English'}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setOpenPreferencesEditor((current) => current === 'language' ? null : 'language');
                        }}
                        className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                          openPreferencesEditor === 'language'
                            ? 'bg-element-hover border-border text-secondary' 
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {openPreferencesEditor === 'language' ? t('actions.cancel') : t('actions.switch')}
                      </button>
                    </div>

                    {/* Expandable Language Drawer */}
                    <div className={`grid transition-all duration-300 ease-in-out ${openPreferencesEditor === 'language' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-4 md:p-5 bg-card/50 border-t border-border/60 flex flex-wrap gap-2">
                          <div className="flex w-full bg-element/50 p-1 rounded-2xl gap-1 border border-border/50">
                            {[
                              { id: 'en', label: 'English' },
                              { id: 'zh-CN', label: '中文' },
                            ].map((langOption) => {
                              const isSelected = locale === langOption.id;
                              return (
                                <button
                                  key={langOption.id}
                                  disabled={isPendingLang || isSelected}
                                  onClick={() => {
                                    if (isSelected || !pathname) return;

                                    startTransition(() => {
                                      document.cookie = `NEXT_LOCALE=${encodeURIComponent(langOption.id)}; Path=/; Max-Age=31536000; SameSite=Lax`;

                                      const queryString = searchParams.toString();
                                      const href = queryString ? `${pathname}?${queryString}` : pathname;

                                      router.replace(href);
                                      router.refresh();
                                      setOpenPreferencesEditor(null);
                                    });
                                  }}
                                  className={`flex-1 text-[12px] font-bold py-2 rounded-xl transition-all active:scale-95 ${
                                    isSelected
                                      ? 'bg-white dark:bg-zinc-100 text-black shadow-sm'
                                      : 'text-secondary hover:text-primary'
                                  } disabled:cursor-default disabled:opacity-100`}
                                >
                                  {langOption.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tPreferences('performance')}</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 group-hover/item:scale-110 group-hover/item:ring-4 group-hover/item:ring-black/5">
                        <Zap className="w-4 h-4 text-secondary transition-colors group-hover/item:text-primary" />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">{tPreferences('realTimeSync')}</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">{tPreferences('realTimeSyncDesc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => updatePreference('realTimeSync', !prefs.realTimeSync)}
                      className={`w-10 h-5 ${prefs.realTimeSync ? 'bg-primary' : 'bg-element shadow-inner'} rounded-full relative transition-all active:scale-90 border border-border/50`}
                    >
                      <div className={`absolute ${prefs.realTimeSync ? 'left-[22px]' : 'left-0.5'} top-0.5 w-4 h-4 bg-white dark:bg-zinc-100 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-all`}></div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tax & Accounting Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tPreferences('taxAccounting')}</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${openPreferencesEditor === 'costBasis' ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                        <FileText className={`w-4 h-4 transition-colors duration-300 ${openPreferencesEditor === 'costBasis' ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">{tPreferences('costBasisMethod')}</div>
                        <div className="text-[13px] text-secondary font-medium mt-0.5">
                          {getCostBasisLabel(prefs.costBasisMethod)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setOpenPreferencesEditor((current) => current === 'costBasis' ? null : 'costBasis')}
                      className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                        openPreferencesEditor === 'costBasis'
                          ? 'bg-element-hover border-border text-secondary'
                          : 'bg-card border-border text-primary hover:bg-element-hover'
                      }`}
                    >
                      {openPreferencesEditor === 'costBasis' ? t('actions.cancel') : t('actions.change')}
                    </button>
                  </div>
                  {/* Expandable Cost Basis Drawer */}
                  <div className={`grid transition-all duration-300 ease-in-out ${openPreferencesEditor === 'costBasis' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="p-4 md:p-5 bg-card border-t border-border/60 flex gap-2">
                        {([
                          { id: 'FIFO', label: 'FIFO', desc: tPreferences('costBasisFifoDesc') },
                          { id: 'AVCO', label: 'AVCO', desc: tPreferences('costBasisAvcoDesc') },
                        ] as const).map((method) => (
                          <button
                            key={method.id}
                            onClick={() => {
                              updatePreference('costBasisMethod', method.id);
                              setOpenPreferencesEditor(null);
                            }}
                            className={`flex-1 flex flex-col items-start px-4 py-3 rounded-xl transition-all active:scale-[0.98] border ${
                              prefs.costBasisMethod === method.id
                                ? 'bg-primary border-primary text-on-primary shadow-sm'
                                : 'bg-element border-border text-primary hover:border-border hover:bg-element-hover'
                            }`}
                          >
                            <span className="text-[13px] font-bold">{method.label}</span>
                            <span className={`text-[11px] font-medium mt-0.5 ${prefs.costBasisMethod === method.id ? 'text-secondary' : 'text-secondary'}`}>
                              {method.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: NOTIFICATIONS */}
          <div id="notifications" ref={notificationsRef} className="scroll-mt-24 md:scroll-mt-32">
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">{tNotificationCenter('title')}</h2>
            </div>
            
            <div className="space-y-6 bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border mb-12 md:mb-16">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tNotificationCenter('marketAlerts')}</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center"><TrendingUp className="w-4 h-4 text-secondary" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">{tNotificationCenter('priceVolatility')}</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">{tNotificationCenter('priceVolatilityDesc')}</div>
                      </div>
                    </div>
                    {renderToggle(true)}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tNotificationCenter('reporting')}</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between border-b border-border">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center"><FileText className="w-4 h-4 text-secondary" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">{tNotificationCenter('dailyDigest')}</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">{tNotificationCenter('dailyDigestDesc')}</div>
                      </div>
                    </div>
                    {renderToggle(false)}
                  </div>
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center"><Mail className="w-4 h-4 text-secondary" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">{tNotificationCenter('weeklyNewsletter')}</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">{tNotificationCenter('weeklyNewsletterDesc')}</div>
                      </div>
                    </div>
                    {renderToggle(true)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: ACCOUNT & SECURITY */}
          <div id="account" ref={accountRef} className="scroll-mt-24 md:scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">{tAccount('title')}</h2>
              <p className="text-[13px] text-secondary font-medium mt-1">
                {isLoggedIn 
                  ? tAccount('descriptionLoggedIn')
                  : tAccount('descriptionLoggedOut')}
              </p>
            </div>
            
            <div className="bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border">
              {isLoggedIn ? (
                <div className="space-y-8">
                  {/* Profile Block */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tAccount('profile')}</h3>
                    
                    <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                      {/* Name & Avatar */}
                      <div className="flex items-center justify-between p-4 md:p-5 bg-transparent border-b border-border">
                        <div className="flex items-center space-x-3 md:space-x-4">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-base md:text-lg shrink-0 shadow-sm">
                            {(user?.user_metadata?.display_name || user?.email)?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] md:text-[15px] font-bold text-primary truncate">
                              {user?.user_metadata?.display_name || user?.email?.split('@')[0]}
                            </div>
                            <div className="text-[12px] md:text-[13px] text-secondary font-medium truncate">{user?.email}</div>
                          </div>
                        </div>
                      </div>

                      {/* Device Context */}
                      {user?.last_sign_in_at && (
                        <div className="px-4 py-3.5 bg-transparent border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0">
                          <div className="flex items-center space-x-2.5">
                            <Monitor className="w-3.5 h-3.5 text-secondary shrink-0" />
                            <span className="text-[11px] font-medium text-secondary uppercase tracking-wider truncate sm:whitespace-normal">
                              {tAccount('lastSession')}: {sessionDateFormatter.format(new Date(user.last_sign_in_at))}
                              <span className="hidden sm:inline"> {tAccount('at')} {sessionTimeFormatter.format(new Date(user.last_sign_in_at))}</span>
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 opacity-60 ml-6 sm:ml-0 shrink-0">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
                            <span className="text-[11px] font-bold text-secondary">
                              {typeof window !== 'undefined' && (
                                <>
                                  {navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Win') ? 'Windows' : 'Mobile'}
                                  {' • '}
                                  {navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Safari' : 'Chromium'}
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Account Verified Status */}
                      <div className="px-4 py-3.5 bg-transparent border-b border-border flex items-start space-x-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 mt-[1px] shrink-0" />
                        <div>
                          <div className="text-[13px] font-bold text-emerald-700">{tAccount('accountVerified')}</div>
                          <div className="text-[12px] text-emerald-600/80 font-medium mt-0.5">{tAccount('accountVerifiedDesc')}</div>
                        </div>
                      </div>

                      {/* Sign Out Action */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-between px-4 py-3.5 bg-transparent hover:bg-element-hover transition-colors active:bg-gray-200 group"
                      >
                        <div className="flex items-center space-x-2.5">
                          <LogOut className="w-3.5 h-3.5 text-rose-500 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                          <span className="text-[13px] font-bold text-rose-500">{tAccount('signOut')}</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Login Credentials */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tAccount('loginCredentials')}</h3>
                    <div className="bg-element/50 rounded-2xl border border-border overflow-hidden transition-all duration-300">

                      {/* Display Name Row */}
                      <div className="border-b border-border bg-card sm:bg-transparent">
                        <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center space-x-3 md:space-x-4 min-w-0 mr-3">
                            <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center shrink-0 transition-all duration-300 ${isEditingDisplayName ? 'scale-110 border-border ring-4 ring-black/5' : ''}`}>
                              <UserCircle className={`w-4 h-4 transition-colors duration-300 ${isEditingDisplayName ? 'text-primary' : 'text-secondary'}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[14px] font-bold text-primary leading-tight">{tAccount('displayName')}</div>
                              <div className="text-[12px] md:text-[13px] text-secondary font-medium mt-0.5 truncate">
                                {user?.user_metadata?.display_name || user?.email?.split('@')[0]}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setNewDisplayName(user?.user_metadata?.display_name || user?.email?.split('@')[0] || '');
                              setIsEditingDisplayName(!isEditingDisplayName);
                              setIsEditingEmail(false);
                              setIsEditingPassword(false);
                              setAuthError(null);
                            }}
                            className={`shrink-0 text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 border ${
                              isEditingDisplayName
                                ? 'bg-element-hover border-border text-secondary'
                                : 'bg-card border-border text-primary hover:bg-element-hover'
                            }`}
                          >
                            {isEditingDisplayName ? t('actions.cancel') : t('actions.change')}
                          </button>
                        </div>
                        <div className={`grid transition-all duration-300 ease-in-out ${isEditingDisplayName ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="p-4 md:p-5 bg-card border-t border-border/60 space-y-4">
                              <form onSubmit={handleUpdateDisplayName} className="space-y-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">{tAccount('newDisplayName')}</label>
                                  <input
                                    type="text"
                                    required
                                    value={newDisplayName}
                                    onChange={(e) => setNewDisplayName(e.target.value)}
                                    placeholder={tAccount('displayNamePlaceholder')}
                                    className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-secondary"
                                  />
                                </div>
                                {authError && isEditingDisplayName && (
                                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <p className="text-[13px] text-rose-600 font-medium leading-tight">{authError}</p>
                                  </div>
                                )}
                                <button
                                  type="submit"
                                  disabled={authActionLoading || !newDisplayName.trim()}
                                  className="w-full bg-primary text-on-primary text-[13px] font-bold py-2.5 rounded-xl hover:bg-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                                >
                                  {authActionLoading && isEditingDisplayName && <Loader2 className="w-4 h-4 animate-spin" />}
                                  {authActionLoading && isEditingDisplayName ? tAccount('updating') : tAccount('updateName')}
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Email Row */}
                      <div className="border-b border-border bg-card sm:bg-transparent">
                        <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center space-x-3 md:space-x-4 min-w-0 mr-3">
                            <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center shrink-0 transition-all duration-300 ${isEditingEmail ? 'scale-110 border-border ring-4 ring-black/5' : ''}`}>
                              <Mail className={`w-4 h-4 transition-colors duration-300 ${isEditingEmail ? 'text-primary' : 'text-secondary'}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[14px] font-bold text-primary leading-tight">{tAccount('emailAddress')}</div>
                              <div className="text-[12px] md:text-[13px] text-secondary font-medium mt-0.5 truncate">{user?.email}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setIsEditingEmail(!isEditingEmail);
                              setIsEditingPassword(false);
                              setIsEditingDisplayName(false);
                              setAuthError(null);
                              setNewEmail('');
                            }}
                            className={`shrink-0 text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                              isEditingEmail 
                                ? 'bg-element-hover border-border text-secondary' 
                                : 'bg-card border-border text-primary hover:bg-element-hover'
                            }`}
                          >
                            {isEditingEmail ? t('actions.cancel') : t('actions.change')}
                          </button>
                        </div>
                        
                        {/* Expandable Email Editor */}
                        <div className={`grid transition-all duration-300 ease-in-out ${isEditingEmail ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="p-4 md:p-5 bg-card border-t border-border/60 space-y-4">
                              <form onSubmit={handleUpdateEmail} className="space-y-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">{tAccount('newEmailAddress')}</label>
                                  <input 
                                    type="email" 
                                    required
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder={tAccount('newEmailPlaceholder')}
                                    className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-secondary"
                                  />
                                </div>
                                {authError && isEditingEmail && (
                                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <p className="text-[13px] text-rose-600 font-medium leading-tight">{authError}</p>
                                  </div>
                                )}
                                <button 
                                  type="submit"
                                  disabled={authActionLoading || !newEmail || newEmail === user?.email}
                                  className="w-full bg-primary text-on-primary text-[13px] font-bold py-2.5 rounded-xl hover:bg-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                                >
                                  {authActionLoading && isEditingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
                                  {authActionLoading && isEditingEmail ? tAccount('updating') : tAccount('updateEmail')}
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Password Row */}
                      <div className="bg-card sm:bg-transparent">
                        <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center space-x-3 md:space-x-4">
                            <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center shrink-0 transition-all duration-300 ${isEditingPassword ? 'scale-110 border-border ring-4 ring-black/5' : ''}`}>
                              <Lock className={`w-4 h-4 transition-colors duration-300 ${isEditingPassword ? 'text-primary' : 'text-secondary'}`} />
                            </div>
                            <div>
                              <div className="text-[14px] font-bold text-primary leading-tight">{tAccount('password')}</div>
                              <div className="text-[13px] text-secondary font-medium mt-0.5 tracking-widest mt-1">••••••••</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setIsEditingPassword(!isEditingPassword);
                              setIsEditingEmail(false);
                              setIsEditingDisplayName(false);
                              setAuthError(null);
                              setNewPassword('');
                              setConfirmPassword('');
                            }}
                            className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                              isEditingPassword 
                                ? 'bg-element-hover border-border text-secondary' 
                                : 'bg-card border-border text-primary hover:bg-element-hover'
                            }`}
                          >
                            {isEditingPassword ? t('actions.cancel') : t('actions.update')}
                          </button>
                        </div>
                        
                        {/* Expandable Password Editor */}
                        <div className={`grid transition-all duration-300 ease-in-out ${isEditingPassword ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="p-4 md:p-5 bg-card border-t border-border/60 space-y-4">
                              <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">{tAccount('newPassword')}</label>
                                  <div className="relative">
                                    <input 
                                      type={showPassword ? "text" : "password"} 
                                      required
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      placeholder={tAccount('newPasswordPlaceholder')}
                                      className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-secondary"
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-secondary transition-colors"
                                    >
                                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">{tAccount('confirmNewPassword')}</label>
                                  <input 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder={tAccount('confirmNewPasswordPlaceholder')}
                                    className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-secondary"
                                  />
                                </div>
                                {authError && isEditingPassword && (
                                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <p className="text-[13px] text-rose-600 font-medium leading-tight">{authError}</p>
                                  </div>
                                )}
                                <button 
                                  type="submit"
                                  disabled={authActionLoading || !newPassword || newPassword !== confirmPassword}
                                  className="w-full bg-primary text-on-primary text-[13px] font-bold py-2.5 rounded-xl hover:bg-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                                >
                                  {authActionLoading && isEditingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                                  {authActionLoading && isEditingPassword ? tAccount('updating') : tAccount('updatePassword')}
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Access Control */}
                  <div className="space-y-4 select-none">
                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tAccount('accessControl')}</h3>
                    <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                      <div className="px-4 md:px-5 py-4 flex items-center justify-between border-b border-border">
                        <div className="flex items-center space-x-3 md:space-x-4">
                          <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-secondary" /></div>
                          <div>
                            <div className="text-[14px] font-bold text-primary leading-tight">{tAccount('twoFactorAuth')}</div>
                            <div className="text-[13px] text-secondary font-medium mt-0.5">{tAccount('disabled')}</div>
                          </div>
                        </div>
                        <button className="text-[12px] md:text-[13px] font-bold text-primary border border-border bg-card hover:bg-element-hover px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">{t('actions.enable')}</button>
                      </div>
                      <PasskeySection user={user} />
                    </div>
                  </div>

                  {/* API Management */}
                  <div className="space-y-4 select-none">
                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">{tAccount('apiManagement')}</h3>
                    <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                      <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3 md:space-x-4 min-w-0 mr-3">
                          <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center shrink-0 transition-all duration-300 transition-all duration-300"><Key className="w-4 h-4 text-secondary transition-colors duration-300" /></div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-bold text-primary leading-tight">{tAccount('finnhubApiKey')}</div>
                            <div className="text-[13px] text-secondary font-medium mt-0.5 tracking-widest mt-1 truncate">••••••••••••</div>
                          </div>
                        </div>
                        <button className="text-[12px] md:text-[13px] font-bold text-primary border border-border bg-card hover:bg-element-hover px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 shrink-0">{t('actions.manage')}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <AuthPanel onLogin={() => router.push('/app')} />
              )}
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-[11px] text-secondary font-medium">
              Folio v1.0.0
            </p>
          </div>

        </div>

        {/* Right Spacer for physical centering */}
        <div className="hidden md:block w-64 flex-shrink-0 invisible pointer-events-none"></div>
      </main>

      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title={t('modal.deleteTitle')}
        description={t('modal.deleteDescription')}
        confirmText={t('modal.deleteConfirm')}
        isLoading={portfolioActionLoading}
      />
    </div>
  );
}
