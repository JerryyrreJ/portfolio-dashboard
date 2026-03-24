'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePreferences } from '@/lib/usePreferences';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { 
  ChevronLeft, 
  Wallet, 
  Settings, 
  Shield, 
  Bell,
  Globe,
  Download,
  Trash2,
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
  CheckCircle2,
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
  initialPortfolios: any[];
}

interface PortfolioItemProps {
  portfolio: any;
  isOnlyOne?: boolean;
  onUpdate: (id: string, name: string, currency: string, field: 'name' | 'currency' | 'both') => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function PortfolioItem({ portfolio, isOnlyOne = false, onUpdate, onDelete }: PortfolioItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [currency, setCurrency] = useState(portfolio.currency);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleToggle = () => {
    if (!isEditing) {
      // Switch context in URL when opening
      const params = new URLSearchParams(searchParams.toString());
      params.set('pid', portfolio.id);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    }
    setIsEditing(!isEditing);
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
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          {!isOnlyOne && (
            <button 
              onClick={() => onDelete(portfolio.id)}
              className="p-1.5 rounded-lg text-secondary hover:text-rose-500 hover:bg-rose-50/50 transition-all active:scale-[0.95]"
              title="Delete Portfolio"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Expandable Editor */}
      <div className={`grid transition-all duration-300 ease-in-out will-change-[grid-template-rows] ${isEditing ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-5 bg-card border-t border-border/60 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Portfolio Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Base Currency</label>
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
                Update Name
              </button>
              <button 
                onClick={() => handleSave('currency')}
                disabled={loading}
                className="flex-1 bg-element-hover text-primary border border-border text-[13px] font-bold py-2.5 rounded-xl hover:bg-element transition-all active:scale-[0.98]"
              >
                Update Currency
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsClient({ initialUser, initialPortfolios }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState('portfolio');
  const [user, setUser] = useState<User | null>(initialUser);
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [portfolioName, setPortfolioName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [portfolioActionLoading, setPortfolioActionLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [allPortfolios, setAllPortfolios] = useState<any[]>(initialPortfolios);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('USD');
  const [createPortfolioLoading, setCreatePortfolioLoading] = useState(false);

  // Inline edit states for Preferences
  const [isEditingTheme, setIsEditingTheme] = useState(false);
  const [isEditingChartType, setIsEditingChartType] = useState(false);
  const [isEditingColorScheme, setIsEditingColorScheme] = useState(false);
  const [isEditingCostBasis, setIsEditingCostBasis] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportRange, setExportRange] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    setExportLoading(true);
    const pidParam = currentPortfolioId ? `&portfolioId=${currentPortfolioId}` : '';
    try {
      if (exportFormat === 'pdf') {
        const response = await fetch(`/api/transactions/export?format=json&range=${exportRange}${pidParam}`);
        if (!response.ok) throw new Error('Failed to fetch data for PDF');
        const data = await response.json();

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Dark header bar
        doc.setFillColor(30, 30, 30);
        doc.rect(0, 0, pageWidth, 18, 'F');

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Folio', 14, 12);

        const rangeLabel = exportRange === 'ytd' ? `YTD ${new Date().getFullYear()}`
          : exportRange === '12m' ? 'Last 12 Months' : 'All Time';
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(rangeLabel, pageWidth - 14, 12, { align: 'right' });

        // Sub-header
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(`${data.portfolio.name}  ·  ${data.portfolio.currency}`, 14, 26);
        doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - 14, 26, { align: 'right' });

        // Separator
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(14, 29, pageWidth - 14, 29);

        let currentY = 36;

        // Summary stat boxes
        const totalCount = data.transactions.length;
        const totalBuy = data.transactions.filter((t: any) => t.type === 'BUY').reduce((s: number, t: any) => s + parseFloat(t.totalValue), 0);
        const totalSell = data.transactions.filter((t: any) => t.type === 'SELL').reduce((s: number, t: any) => s + parseFloat(t.totalValue), 0);
        const portfolioSym = getCurrencySymbol(data.portfolio.currency);

        const statBoxes = [
          { label: 'Transactions', value: String(totalCount) },
          { label: 'Total Bought', value: `${portfolioSym}${totalBuy.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Total Sold',   value: `${portfolioSym}${totalSell.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
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
        const grouped = data.transactions.reduce((acc: Record<string, any[]>, t: any) => {
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

        const bodyRows: any[] = [];
        for (const market of marketOrder) {
          bodyRows.push({ date: market, asset: '', type: '', quantity: '', price: '', fee: '', total: '', currency: '', _isGroupHeader: true });
          for (const t of grouped[market]) {
            const tsym = getCurrencySymbol(t.currency || 'USD');
            bodyRows.push({
              date:     t.date,
              asset:    `${t.ticker}\n${t.name}`,
              type:     t.type,
              quantity: t.quantity,
              price:    `${tsym}${parseFloat(t.price).toFixed(2)}`,
              fee:      `${tsym}${parseFloat(t.fee).toFixed(2)}`,
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
            if (data.row.raw && (data.row.raw as any)._isGroupHeader) {
              data.cell.styles.fillColor = [235, 240, 248];
              data.cell.styles.textColor = [40, 80, 140] as any;
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 8;
              if (data.column.dataKey !== 'date') data.cell.text = [''];
            }
          },
        });

        // Post-pass footer with correct "Page X of Y"
        const totalPages = (doc as any).internal.getNumberOfPages();
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
        showNotification('success', 'PDF Downloaded', 'Your investment report is ready.');
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
        
        showNotification('success', 'Export Complete', `Your data has been downloaded as ${exportFormat.toUpperCase()}.`);
        setIsExporting(false);
      }
    } catch (error: any) {
      showNotification('error', 'Export Failed', error.message || 'We could not export your data.');
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
        ? allPortfolios.find((portfolio: any) => portfolio.id === currentPortfolioId)
        : allPortfolios[0];

      localStorage.setItem('cached_portfolios', JSON.stringify(allPortfolios));

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
  }, [allPortfolios, currentPortfolioId, user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        localStorage.removeItem('portfolio_name');
        localStorage.removeItem('base_currency');
        localStorage.removeItem('settings_updated_at');
        localStorage.removeItem('passkey_credentials');
        setPortfolioName('');
        setBaseCurrency('USD');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const isLoggedIn = !!user;

  // Refs for smooth scrolling and intersection observation
  const accountRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLDivElement>(null);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const navItems = React.useMemo(() => [
    { id: 'portfolio', name: 'Portfolio', icon: <Wallet className="w-4 h-4" />, ref: portfolioRef },
    { id: 'preferences', name: 'Preferences', icon: <Settings className="w-4 h-4" />, ref: preferencesRef },
    { id: 'notifications', name: 'Notifications', icon: <Bell className="w-4 h-4" />, ref: notificationsRef },
    { id: 'account', name: 'Account & Security', icon: <UserCircle className="w-4 h-4" />, ref: accountRef },
  ], []);

  const handleSignOut = async () => {
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
      
      const msg = field === 'both' ? 'Portfolio settings saved locally.' : `${field === 'name' ? 'Name' : 'Currency'} saved locally.`;
      showNotification('success', 'Settings Saved', msg);
      return;
    }

    setPortfolioActionLoading(true);
    setPortfolioError(null);

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
          const updatedPortfolios = allPortfolios.map((p) => p.id === data.portfolio.id ? data.portfolio : p);
          setAllPortfolios(updatedPortfolios);
          localStorage.setItem('cached_portfolios', JSON.stringify(updatedPortfolios));
        }
      }

      showNotification('success', 'Settings Saved', 'Your portfolio configuration has been updated successfully.');

      const now = new Date().toISOString();
      if (id === currentPortfolioId || (!currentPortfolioId && id === allPortfolios[0]?.id)) {
        localStorage.setItem('portfolio_name', newName);
        localStorage.setItem('base_currency', newCurrency);
        setPortfolioName(newName);
        setBaseCurrency(newCurrency);
      }
      localStorage.setItem('settings_updated_at', now);
    } catch (err: any) {
      setPortfolioError(err.message || 'Failed to update portfolio');
      showNotification('error', 'Update Failed', err.message || 'We could not save your changes.');
    } finally {
      setPortfolioActionLoading(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    if (allPortfolios.length <= 1) {
      showNotification('error', 'Cannot Delete', 'You must have at least one portfolio.');
      return;
    }
    
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    const id = deleteConfirm.id;

    setPortfolioActionLoading(true);
    try {
      const res = await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      const remaining = allPortfolios.filter((p) => p.id !== id);
      setAllPortfolios(remaining);
      localStorage.setItem('cached_portfolios', JSON.stringify(remaining));
      showNotification('success', 'Portfolio Deleted', 'The portfolio has been removed.');
      
      if (id === currentPortfolioId) {
        router.push('/settings');
      }
    } catch (err: any) {
      showNotification('error', 'Delete Failed', err.message);
    } finally {
      setPortfolioActionLoading(false);
      setDeleteConfirm({ isOpen: false, id: null });
    }
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
        throw new Error(data?.error || 'Failed to create portfolio');
      }

      const { portfolio } = await res.json();
      const nextPortfolios = [...allPortfolios, portfolio];
      setAllPortfolios(nextPortfolios);
      localStorage.setItem('cached_portfolios', JSON.stringify(nextPortfolios));
      setNewPortfolioName('');
      setNewPortfolioCurrency('USD');
      setIsCreatingPortfolio(false);
      showNotification('success', 'Portfolio Created', 'Your new portfolio is ready.');
      router.push(`/settings?pid=${portfolio.id}#portfolio`);
    } catch (err: any) {
      setPortfolioError(err.message || 'Failed to create portfolio');
      showNotification('error', 'Create Failed', err.message || 'We could not create the portfolio.');
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
      showNotification('success', 'Name Updated', 'Your display name has been updated.');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update display name');
      showNotification('error', 'Update Failed', err.message || 'Failed to update your display name.');
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
      showNotification('success', 'Verification Sent', 'We have sent a link to your new email. Please verify it to complete the change.');
      setIsEditingEmail(false);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update email');
      showNotification('error', 'Update Failed', err.message || 'Failed to update your email address.');
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showNotification('success', 'Password Updated', 'Your password has been changed successfully.');
      setIsEditingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update password');
      showNotification('error', 'Update Failed', err.message || 'Failed to change your password.');
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
        <Link href="/" className="flex items-center space-x-2 text-[14px] font-semibold text-secondary hover:text-primary transition-colors group">
          <div className="w-6 h-6 rounded-full bg-element-hover flex items-center justify-center group-hover:bg-gray-200 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 text-secondary group-hover:text-primary" />
          </div>
          <span>Back to Dashboard</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full py-6 md:py-12 flex flex-col md:flex-row justify-center items-start px-4 sm:px-6 gap-8 md:gap-12 relative">
        
        {/* Sidebar Navigation - Hidden on Mobile */}
        <aside className="hidden md:block w-64 flex-shrink-0 md:sticky md:top-28">
          <h1 className="text-[24px] md:text-[28px] font-bold text-primary tracking-tight mb-6 md:mb-8 pl-4">Settings</h1>
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
            <h1 className="text-[32px] font-bold text-primary tracking-tight">Settings</h1>
          </div>
          
          {/* SECTION: PORTFOLIO */}
          <div id="portfolio" ref={portfolioRef} className="scroll-mt-24 md:scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">Portfolio Management</h2>
              <p className="text-[13px] text-secondary font-medium mt-1">Create, edit, and remove your portfolios from one place.</p>
            </div>
            
            <div className="space-y-6 bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border mb-12 md:mb-16">
              {/* Portfolios Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Portfolios</h3>
                {isLoggedIn ? (
                  <div className="bg-element/50 rounded-2xl border border-border overflow-hidden transition-all duration-300">
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isCreatingPortfolio ? 'scale-110 ring-4 ring-black/5' : ''}`}>
                          <Plus className={`w-4 h-4 transition-colors duration-300 ${isCreatingPortfolio ? 'text-primary' : 'text-secondary'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-bold text-primary leading-tight">Create Portfolio</div>
                          <div className="text-[12px] text-secondary font-medium mt-0.5 leading-snug">
                            Add a new portfolio for a different account, strategy, or goal.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsCreatingPortfolio((prev) => !prev);
                          setPortfolioError(null);
                        }}
                        className={`flex-shrink-0 text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-[0.97] border ${
                          isCreatingPortfolio
                            ? 'bg-element-hover border-border text-secondary'
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {isCreatingPortfolio ? 'Cancel' : 'Create'}
                      </button>
                    </div>

                    <div className={`grid transition-all duration-300 ease-in-out ${isCreatingPortfolio ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-5 bg-card border-t border-border/60 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Portfolio Name</label>
                              <input
                                type="text"
                                value={newPortfolioName}
                                onChange={(e) => setNewPortfolioName(e.target.value)}
                                placeholder="Growth Portfolio"
                                className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary outline-none transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Base Currency</label>
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
                            Create Portfolio
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden transition-all duration-300">
                  {!isLoggedIn ? (
                    /* Guest Mode - Show single local portfolio component */
                    <PortfolioItem 
                      portfolio={{ id: 'local', name: portfolioName, currency: baseCurrency }}
                      isOnlyOne={true}
                      onUpdate={(id, n, c, f) => handleUpdatePortfolio(id, n, c, f)}
                      onDelete={async () => {}} // Guest can't delete
                    />
                  ) : (
                    /* Logged In - List all portfolios */
                    <div className="divide-y divide-border/60">
                      {allPortfolios.map((p) => (
                        <PortfolioItem 
                          key={p.id}
                          portfolio={p}
                          isOnlyOne={allPortfolios.length <= 1}
                          onUpdate={handleUpdatePortfolio}
                          onDelete={handleDeletePortfolio}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Data Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Data Management</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between group/item transition-colors duration-300 gap-3">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isExporting ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                        <Download className={`w-4 h-4 transition-colors duration-300 ${isExporting ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-[14px] font-bold text-primary leading-tight truncate">Export Data</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5 leading-snug truncate sm:whitespace-normal">Download your transaction history</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsExporting(!isExporting)}
                      className={`flex-shrink-0 text-[13px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 border ${
                        isExporting
                          ? 'bg-element-hover border-border text-secondary'
                          : 'bg-card border-border text-primary hover:bg-element-hover'
                      }`}
                    >
                      {isExporting ? 'Cancel' : 'Export'}
                    </button>
                  </div>

                  {/* Expandable Export Drawer */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isExporting ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="p-5 bg-card border-t border-border/60 space-y-6">
                        {/* Range Selection */}
                        <div className="space-y-3">
                          <label className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em]">Time Range</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                            {[
                              { id: 'all', label: 'All Time' },
                              { id: 'ytd', label: 'Year to Date' },
                              { id: '12m', label: 'Past 12M' }
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
                          <label className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em]">File Format</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                            {[
                              { id: 'csv', label: 'CSV', sub: 'Excel / Sheets' },
                              { id: 'json', label: 'JSON', sub: 'Developer' },
                              { id: 'pdf', label: 'PDF', sub: 'Tax / Report' }
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
                              <span>Preparing...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span>Download {exportFormat.toUpperCase()}</span>
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
              <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">Preferences</h2>
            </div>
            
            <div className="space-y-6 bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border mb-12 md:mb-16">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Appearance</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  {/* Theme Row */}
                  <div className="border-b border-border bg-card sm:bg-transparent">
                    <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                      <div className="flex items-center space-x-3 md:space-x-4">
                        <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isEditingTheme ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                          <Monitor className={`w-4 h-4 transition-colors duration-300 ${isEditingTheme ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-primary leading-tight">Theme</div>
                          <div className="text-[13px] text-secondary font-medium mt-0.5">
                            {mounted && theme ? (theme.charAt(0).toUpperCase() + theme.slice(1)) : 'System'}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setIsEditingTheme(!isEditingTheme);
                          setIsEditingChartType(false);
                          setIsEditingColorScheme(false);
                        }}
                        className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 border ${
                          isEditingTheme 
                            ? 'bg-element-hover border-border text-secondary' 
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {isEditingTheme ? 'Cancel' : 'Select'}
                      </button>
                    </div>
                    {/* Expandable Theme Drawer */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isEditingTheme ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-4 md:p-5 bg-card/50 border-t border-border/60 flex flex-wrap gap-2">
                          <div className="flex w-full bg-element/50 p-1 rounded-2xl gap-1">
                            {['Light', 'Dark', 'System'].map((t) => {
                              const isSelected = mounted && theme === t.toLowerCase();
                              return (
                                <button
                                  key={t}
                                  onClick={() => {
                                    setTheme(t.toLowerCase());
                                    updatePreference('theme', t as 'Light' | 'Dark' | 'System');
                                  }}
                                  className={`flex-1 text-[12px] font-bold py-2 rounded-xl transition-all active:scale-95 ${
                                    isSelected
                                      ? 'bg-white dark:bg-zinc-100 text-black shadow-[0_2px_10px_-3px_rgba(0,0,0,0.3)]'
                                      : 'text-secondary hover:text-primary'
                                  }`}
                                >
                                  {t}
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
                        <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isEditingColorScheme ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                          <TrendingUp className={`w-4 h-4 transition-colors duration-300 ${isEditingColorScheme ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-primary leading-tight">Market Colors</div>
                          <div className="text-[13px] text-secondary font-medium mt-0.5">
                            {prefs.colorScheme === 'Emerald' ? 'Emerald Gains / Rose Losses' : 'Rose Gains / Emerald Losses'}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setIsEditingColorScheme(!isEditingColorScheme);
                          setIsEditingTheme(false);
                          setIsEditingChartType(false);
                        }}
                        className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                          isEditingColorScheme 
                            ? 'bg-element-hover border-border text-secondary' 
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {isEditingColorScheme ? 'Cancel' : 'Change'}
                      </button>
                    </div>
                    {/* Expandable Color Scheme Drawer */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isEditingColorScheme ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-4 md:p-5 bg-card border-t border-border/60 flex flex-col space-y-2">
                          {[
                            { id: 'Emerald', label: 'Emerald Gains', desc: 'Green for growth, Red for decline' },
                            { id: 'Rose', label: 'Rose Gains', desc: 'Red for growth, Green for decline' }
                          ].map((scheme) => (
                            <button
                              key={scheme.id}
                              onClick={() => {
                                updatePreference('colorScheme', scheme.id as 'Emerald' | 'Rose');
                                setIsEditingColorScheme(false);
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
                        <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isEditingChartType ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                          <BarChart2 className={`w-4 h-4 transition-colors duration-300 ${isEditingChartType ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-primary leading-tight">Default Chart Type</div>
                          <div className="text-[13px] text-secondary font-medium mt-0.5">{prefs.chartType}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setIsEditingChartType(!isEditingChartType);
                          setIsEditingTheme(false);
                        }}
                        className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                          isEditingChartType 
                            ? 'bg-element-hover border-border text-secondary' 
                            : 'bg-card border-border text-primary hover:bg-element-hover'
                        }`}
                      >
                        {isEditingChartType ? 'Cancel' : 'Switch'}
                      </button>
                    </div>
                    {/* Expandable Chart Type Drawer */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isEditingChartType ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-4 md:p-5 bg-card/50 border-t border-border/60 flex flex-wrap gap-2">
                          <div className="flex w-full bg-element/50 p-1 rounded-2xl gap-1">
                            {['Area', 'Line', 'Bar'].map((c) => {
                              const isSelected = prefs.chartType.startsWith(c);
                              return (
                                <button
                                  key={c}
                                  onClick={() => {
                                    updatePreference('chartType', `${c} Chart` as 'Area Chart' | 'Line Chart' | 'Bar Chart');
                                    setIsEditingChartType(false);
                                  }}
                                  className={`flex-1 text-[12px] font-bold py-2 rounded-xl transition-all active:scale-95 ${
                                    isSelected
                                      ? 'bg-white dark:bg-zinc-100 text-black shadow-sm'
                                      : 'text-secondary hover:text-primary'
                                  }`}
                                >
                                  {c}
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
                        <div className="text-[14px] font-bold text-primary leading-tight">Hide Small Balances</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">Hide holdings &lt; $10</div>
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

              {/* Performance Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Performance</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 group-hover/item:scale-110 group-hover/item:ring-4 group-hover/item:ring-black/5">
                        <Zap className="w-4 h-4 text-secondary transition-colors group-hover/item:text-primary" />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">Real-time Sync</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">Faster updates</div>
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
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Tax & Accounting</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between group/item">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${isEditingCostBasis ? 'scale-110 border-border ring-4 ring-black/5' : 'group-hover/item:border-border'}`}>
                        <FileText className={`w-4 h-4 transition-colors duration-300 ${isEditingCostBasis ? 'text-primary' : 'text-secondary group-hover/item:text-primary'}`} />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">Cost Basis Method</div>
                        <div className="text-[13px] text-secondary font-medium mt-0.5">
                          {prefs.costBasisMethod === 'FIFO' ? 'First In, First Out' : 'Average Cost'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditingCostBasis(!isEditingCostBasis)}
                      className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                        isEditingCostBasis
                          ? 'bg-element-hover border-border text-gray-700'
                          : 'bg-card border-border text-primary hover:bg-element-hover'
                      }`}
                    >
                      {isEditingCostBasis ? 'Cancel' : 'Change'}
                    </button>
                  </div>
                  {/* Expandable Cost Basis Drawer */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isEditingCostBasis ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="p-4 md:p-5 bg-card border-t border-border/60 flex gap-2">
                        {([
                          { id: 'FIFO', label: 'FIFO', desc: 'First In, First Out' },
                          { id: 'AVCO', label: 'AVCO', desc: 'Average Cost' },
                        ] as const).map((method) => (
                          <button
                            key={method.id}
                            onClick={() => {
                              updatePreference('costBasisMethod', method.id);
                              setIsEditingCostBasis(false);
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
              <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">Notifications</h2>
            </div>
            
            <div className="space-y-6 bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border mb-12 md:mb-16">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Market Alerts</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center"><TrendingUp className="w-4 h-4 text-secondary" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">Price Volatility</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">Alert on &gt;5% moves</div>
                      </div>
                    </div>
                    {renderToggle(true)}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Reporting</h3>
                <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between border-b border-border">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center"><FileText className="w-4 h-4 text-secondary" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">Daily Digest</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">Post-market summary</div>
                      </div>
                    </div>
                    {renderToggle(false)}
                  </div>
                  <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center"><Mail className="w-4 h-4 text-secondary" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-primary leading-tight">Weekly Newsletter</div>
                        <div className="text-[12px] text-secondary font-medium mt-0.5">Insights and returns</div>
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
              <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">Account & Security</h2>
              <p className="text-[13px] text-secondary font-medium mt-1">
                {isLoggedIn 
                  ? 'Manage your account profile, authentication, and security preferences.' 
                  : 'Log in or create an account to sync your portfolio.'}
              </p>
            </div>
            
            <div className="bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border">
              {isLoggedIn ? (
                <div className="space-y-8">
                  {/* Profile Block */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Profile</h3>
                    
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
                              Last Session: {new Date(user.last_sign_in_at).toLocaleDateString()}
                              <span className="hidden sm:inline"> at {new Date(user.last_sign_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                          <div className="text-[13px] font-bold text-emerald-700">Account Verified</div>
                          <div className="text-[12px] text-emerald-600/80 font-medium mt-0.5">Your data is securely synchronized with Supabase Cloud.</div>
                        </div>
                      </div>

                      {/* Sign Out Action */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-between px-4 py-3.5 bg-transparent hover:bg-element-hover transition-colors active:bg-gray-200 group"
                      >
                        <div className="flex items-center space-x-2.5">
                          <LogOut className="w-3.5 h-3.5 text-rose-500 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                          <span className="text-[13px] font-bold text-rose-500">Sign Out</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Login Credentials */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Login Credentials</h3>
                    <div className="bg-element/50 rounded-2xl border border-border overflow-hidden transition-all duration-300">

                      {/* Display Name Row */}
                      <div className="border-b border-border bg-card sm:bg-transparent">
                        <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center space-x-3 md:space-x-4 min-w-0 mr-3">
                            <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center shrink-0 transition-all duration-300 ${isEditingDisplayName ? 'scale-110 border-border ring-4 ring-black/5' : ''}`}>
                              <UserCircle className={`w-4 h-4 transition-colors duration-300 ${isEditingDisplayName ? 'text-primary' : 'text-secondary'}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[14px] font-bold text-primary leading-tight">Display Name</div>
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
                            {isEditingDisplayName ? 'Cancel' : 'Change'}
                          </button>
                        </div>
                        <div className={`grid transition-all duration-300 ease-in-out ${isEditingDisplayName ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="p-4 md:p-5 bg-card border-t border-border/60 space-y-4">
                              <form onSubmit={handleUpdateDisplayName} className="space-y-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">New Display Name</label>
                                  <input
                                    type="text"
                                    required
                                    value={newDisplayName}
                                    onChange={(e) => setNewDisplayName(e.target.value)}
                                    placeholder="Enter your display name"
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
                                  {authActionLoading && isEditingDisplayName ? 'Updating...' : 'Update Name'}
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
                              <div className="text-[14px] font-bold text-primary leading-tight">Email Address</div>
                              <div className="text-[12px] md:text-[13px] text-secondary font-medium mt-0.5 truncate">{user?.email}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setIsEditingEmail(!isEditingEmail);
                              setIsEditingPassword(false);
                              setIsEditingDisplayName(false);
                              setAuthError(null);
                              setEmailSuccess(false);
                              setNewEmail('');
                            }}
                            className={`shrink-0 text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                              isEditingEmail 
                                ? 'bg-element-hover border-border text-secondary' 
                                : 'bg-card border-border text-primary hover:bg-element-hover'
                            }`}
                          >
                            {isEditingEmail ? 'Cancel' : 'Change'}
                          </button>
                        </div>
                        
                        {/* Expandable Email Editor */}
                        <div className={`grid transition-all duration-300 ease-in-out ${isEditingEmail ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="p-4 md:p-5 bg-card border-t border-border/60 space-y-4">
                              <form onSubmit={handleUpdateEmail} className="space-y-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">New Email Address</label>
                                  <input 
                                    type="email" 
                                    required
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="Enter your new email"
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
                                  {authActionLoading && isEditingEmail ? 'Updating...' : 'Update Email'}
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
                              <div className="text-[14px] font-bold text-primary leading-tight">Password</div>
                              <div className="text-[13px] text-secondary font-medium mt-0.5 tracking-widest mt-1">••••••••</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setIsEditingPassword(!isEditingPassword);
                              setIsEditingEmail(false);
                              setIsEditingDisplayName(false);
                              setAuthError(null);
                              setPasswordSuccess(false);
                              setNewPassword('');
                              setConfirmPassword('');
                            }}
                            className={`text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                              isEditingPassword 
                                ? 'bg-element-hover border-border text-secondary' 
                                : 'bg-card border-border text-primary hover:bg-element-hover'
                            }`}
                          >
                            {isEditingPassword ? 'Cancel' : 'Update'}
                          </button>
                        </div>
                        
                        {/* Expandable Password Editor */}
                        <div className={`grid transition-all duration-300 ease-in-out ${isEditingPassword ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="p-4 md:p-5 bg-card border-t border-border/60 space-y-4">
                              <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">New Password</label>
                                  <div className="relative">
                                    <input 
                                      type={showPassword ? "text" : "password"} 
                                      required
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      placeholder="Enter new password"
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
                                  <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Confirm New Password</label>
                                  <input 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
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
                                  {authActionLoading && isEditingPassword ? 'Updating...' : 'Update Password'}
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
                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Access Control</h3>
                    <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                      <div className="px-4 md:px-5 py-4 flex items-center justify-between border-b border-border">
                        <div className="flex items-center space-x-3 md:space-x-4">
                          <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-secondary" /></div>
                          <div>
                            <div className="text-[14px] font-bold text-primary leading-tight">Two-Factor Auth</div>
                            <div className="text-[13px] text-secondary font-medium mt-0.5">Disabled</div>
                          </div>
                        </div>
                        <button className="text-[12px] md:text-[13px] font-bold text-primary border border-border bg-card hover:bg-element-hover px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Enable</button>
                      </div>
                      <PasskeySection user={user} />
                    </div>
                  </div>

                  {/* API Management */}
                  <div className="space-y-4 select-none">
                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">API Management</h3>
                    <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                      <div className="px-4 md:px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3 md:space-x-4 min-w-0 mr-3">
                          <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center shrink-0 transition-all duration-300 transition-all duration-300"><Key className="w-4 h-4 text-secondary transition-colors duration-300" /></div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-bold text-primary leading-tight">Finnhub API Key</div>
                            <div className="text-[13px] text-secondary font-medium mt-0.5 tracking-widest mt-1 truncate">••••••••••••</div>
                          </div>
                        </div>
                        <button className="text-[12px] md:text-[13px] font-bold text-primary border border-border bg-card hover:bg-element-hover px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 shrink-0">Manage</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <AuthPanel onLogin={() => router.push('/')} />
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
        title="Delete Portfolio"
        description="Are you sure you want to delete this portfolio and all its transactions? This action cannot be undone."
        confirmText="Delete Portfolio"
        isLoading={portfolioActionLoading}
      />
    </div>
  );
}
