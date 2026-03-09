'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Fingerprint,
  Key,
  TrendingUp,
  FileText,
  UserCircle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye
} from 'lucide-react';
import AuthPanel from '@/app/components/settings/AuthPanel';
import { createClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Notification from '@/app/components/Notification';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('portfolio');
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  
  const supabase = createClient();

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

  const [isEditingPortfolioName, setIsEditingPortfolioName] = useState(false);
  const [isEditingBaseCurrency, setIsEditingBaseCurrency] = useState(false);
  const [portfolioName, setPortfolioName] = useState('Main Account');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [portfolioActionLoading, setPortfolioActionLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

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
    const fetchUserAndPortfolio = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        try {
          const res = await fetch('/api/portfolio');
          if (res.ok) {
            const data = await res.json();
            setPortfolioName(data.portfolio.name || 'Main Account');
            setBaseCurrency(data.portfolio.currency || 'USD');
          }
        } catch (e) {
          console.error("Failed to fetch portfolio settings", e);
        }
      }
    };

    fetchUserAndPortfolio();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setPortfolioName('Main Account');
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
    { id: 'account', name: isLoggedIn ? 'Account & Security' : 'Account', icon: <UserCircle className="w-4 h-4" />, ref: accountRef },
  ], [isLoggedIn]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleUpdatePortfolio = async (e: React.FormEvent, field: 'name' | 'currency') => {
    e.preventDefault();
    if (!isLoggedIn) return;

    setPortfolioActionLoading(true);
    setPortfolioError(null);

    try {
      const payload = field === 'name' ? { name: portfolioName } : { currency: baseCurrency };
      const res = await fetch('/api/portfolio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update portfolio');
      }

      showNotification('success', 'Settings Saved', 'Your portfolio configuration has been updated successfully.');
      
      if (field === 'name') {
        setIsEditingPortfolioName(false);
      } else {
        setIsEditingBaseCurrency(false);
      }
    } catch (err: any) {
      setPortfolioError(err.message || 'Failed to update portfolio');
      showNotification('error', 'Update Failed', err.message || 'We could not save your changes.');
    } finally {
      setPortfolioActionLoading(false);
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
    <button className={`w-10 h-5 ${enabled ? 'bg-black' : 'bg-gray-200'} rounded-full relative transition-colors`}>
      <div className={`absolute ${enabled ? 'left-[22px]' : 'left-0.5'} top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all`}></div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased flex flex-col">
      <Notification 
        show={notification.show} 
        type={notification.type} 
        title={notification.title} 
        message={notification.message} 
        onClose={() => setNotification({ ...notification, show: false })} 
      />
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center sticky top-0 z-50 transition-all">
        <Link href="/" className="flex items-center space-x-2 text-[14px] font-semibold text-gray-500 hover:text-black transition-colors group">
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 text-gray-600 group-hover:text-black" />
          </div>
          <span>Back to Dashboard</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full py-12 flex flex-col md:flex-row justify-center items-start px-6 gap-12 relative">
        
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0 md:sticky md:top-28">
          <h1 className="text-[28px] font-bold text-black tracking-tight mb-8 pl-4">Settings</h1>
          <nav className="flex flex-col space-y-1.5 relative">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button 
                  key={item.id}
                  onClick={() => scrollToSection(item.id, item.ref)}
                  className={`flex items-center space-x-3 px-4 py-3.5 rounded-[14px] text-[14px] font-semibold transition-all group w-full text-left ${
                    isActive 
                      ? 'bg-white shadow-sm text-black border border-gray-100/50' 
                      : 'text-gray-500 hover:bg-gray-100/50 hover:text-gray-900 border border-transparent'
                  }`}
                >
                  <div className={`${isActive ? 'text-black' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}>
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
          
          {/* SECTION: PORTFOLIO */}
          <div id="portfolio" ref={portfolioRef} className="scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-[20px] font-bold text-black tracking-tight">Portfolio Settings</h2>
              <p className="text-[13px] text-gray-400 font-medium mt-1">Manage your core portfolio configuration and data.</p>
            </div>
            
            <div className="space-y-6 bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-16">
              {/* General Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">General</h3>
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300">
                  <div className="border-b border-gray-100 bg-white sm:bg-transparent">
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Wallet className="w-4 h-4 text-gray-400" /></div>
                        <div>
                          <div className="text-[14px] font-bold text-black leading-tight">Portfolio Name</div>
                          <div className="text-[13px] text-gray-500 font-medium mt-0.5">{portfolioName}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setIsEditingPortfolioName(!isEditingPortfolioName);
                          setIsEditingBaseCurrency(false);
                          setPortfolioError(null);
                        }}
                        className={`text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                          isEditingPortfolioName 
                            ? 'bg-gray-100 border-gray-200 text-gray-700' 
                            : 'bg-white border-gray-100 text-black hover:bg-gray-100'
                        }`}
                      >
                        {isEditingPortfolioName ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    {/* Expandable Portfolio Name Editor */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isEditingPortfolioName ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-5 bg-white border-t border-gray-100/60 space-y-4">
                          <form onSubmit={(e) => handleUpdatePortfolio(e, 'name')} className="space-y-4">
                            <div>
                              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Portfolio Name</label>
                              <input 
                                type="text" 
                                required
                                value={portfolioName}
                                onChange={(e) => setPortfolioName(e.target.value)}
                                placeholder="Enter portfolio name"
                                className="w-full px-4 py-2.5 bg-gray-50/50 rounded-xl text-[14px] text-black font-medium border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-gray-400"
                              />
                            </div>
                            <button 
                              type="submit"
                              disabled={portfolioActionLoading || !portfolioName.trim()}
                              className="w-full bg-black text-white text-[13px] font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                            >
                              {portfolioActionLoading && isEditingPortfolioName && <Loader2 className="w-4 h-4 animate-spin" />}
                              {portfolioActionLoading && isEditingPortfolioName ? 'Updating...' : 'Save Name'}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white sm:bg-transparent">
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Globe className="w-4 h-4 text-gray-400" /></div>
                        <div>
                          <div className="text-[14px] font-bold text-black leading-tight">Base Currency</div>
                          <div className="text-[13px] text-gray-500 font-medium mt-0.5">{baseCurrency}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setIsEditingBaseCurrency(!isEditingBaseCurrency);
                          setIsEditingPortfolioName(false);
                          setPortfolioError(null);
                        }}
                        className={`text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                          isEditingBaseCurrency 
                            ? 'bg-gray-100 border-gray-200 text-gray-700' 
                            : 'bg-white border-gray-100 text-black hover:bg-gray-100'
                        }`}
                      >
                        {isEditingBaseCurrency ? 'Cancel' : 'Change'}
                      </button>
                    </div>
                    {/* Expandable Base Currency Editor */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isEditingBaseCurrency ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-5 bg-white border-t border-gray-100/60 space-y-4">
                          <form onSubmit={(e) => handleUpdatePortfolio(e, 'currency')} className="space-y-4">
                            <div>
                              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Select Currency</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                  { code: 'USD', name: 'US Dollar', symbol: '$' },
                                  { code: 'EUR', name: 'Euro', symbol: '€' },
                                  { code: 'GBP', name: 'British Pound', symbol: '£' },
                                  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
                                  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
                                  { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$' },
                                  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
                                  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
                                  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
                                ].map((currency) => (
                                  <button
                                    key={currency.code}
                                    type="button"
                                    onClick={() => setBaseCurrency(currency.code)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl border text-[13px] transition-all active:scale-95 ${
                                      baseCurrency === currency.code
                                        ? 'border-black bg-black text-white shadow-sm'
                                        : 'border-gray-200 bg-white text-black hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex flex-col items-start">
                                      <span className="font-bold leading-none">{currency.code}</span>
                                      <span className={`text-[10px] mt-1 font-medium ${baseCurrency === currency.code ? 'text-gray-300' : 'text-gray-400'}`}>
                                        {currency.name}
                                      </span>
                                    </div>
                                    <span className={`text-[14px] font-medium ${baseCurrency === currency.code ? 'text-gray-300' : 'text-gray-400'}`}>
                                      {currency.symbol}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button 
                              type="submit"
                              disabled={portfolioActionLoading}
                              className="w-full bg-black text-white text-[13px] font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm mt-4"
                            >
                              {portfolioActionLoading && isEditingBaseCurrency && <Loader2 className="w-4 h-4 animate-spin" />}
                              {portfolioActionLoading && isEditingBaseCurrency ? 'Updating...' : 'Save Currency'}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Data Management</h3>
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Download className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Export Data</div>
                        <div className="text-[12px] text-gray-400 font-medium mt-0.5">Download all history as CSV</div>
                      </div>
                    </div>
                    <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Export</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: PREFERENCES */}
          <div id="preferences" ref={preferencesRef} className="scroll-mt-32">
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-[20px] font-bold text-black tracking-tight">Preferences</h2>
            </div>
            
            <div className="space-y-6 bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-16">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Appearance</h3>
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Monitor className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Theme</div>
                        <div className="text-[13px] text-gray-500 font-medium mt-0.5">Follow System</div>
                      </div>
                    </div>
                    <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Select</button>
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><BarChart2 className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Default Chart Type</div>
                        <div className="text-[13px] text-gray-500 font-medium mt-0.5">Area Chart</div>
                      </div>
                    </div>
                    <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Switch</button>
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><EyeOff className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Hide Small Balances</div>
                        <div className="text-[12px] text-gray-400 font-medium mt-0.5">Hide holdings &lt; $10</div>
                      </div>
                    </div>
                    {renderToggle(false)}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Performance</h3>
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Zap className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Real-time Sync</div>
                        <div className="text-[12px] text-gray-400 font-medium mt-0.5">Faster updates (uses more battery)</div>
                      </div>
                    </div>
                    {renderToggle(true)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: NOTIFICATIONS */}
          <div id="notifications" ref={notificationsRef} className="scroll-mt-32">
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-[20px] font-bold text-black tracking-tight">Notifications</h2>
            </div>
            
            <div className="space-y-6 bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-16">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Market Alerts</h3>
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><TrendingUp className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Price Volatility</div>
                        <div className="text-[12px] text-gray-400 font-medium mt-0.5">Alert on &gt;5% daily moves</div>
                      </div>
                    </div>
                    {renderToggle(true)}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Reporting</h3>
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><FileText className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Daily Digest</div>
                        <div className="text-[12px] text-gray-400 font-medium mt-0.5">Post-market summary</div>
                      </div>
                    </div>
                    {renderToggle(false)}
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Mail className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Weekly Newsletter</div>
                        <div className="text-[12px] text-gray-400 font-medium mt-0.5">Insights and returns</div>
                      </div>
                    </div>
                    {renderToggle(true)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: ACCOUNT & SECURITY */}
          <div id="account" ref={accountRef} className="scroll-mt-32">
            <div className="mb-6">
              <h2 className="text-[20px] font-bold text-black tracking-tight">{isLoggedIn ? 'Account & Security' : 'Account'}</h2>
              <p className="text-[13px] text-gray-400 font-medium mt-1">
                {isLoggedIn 
                  ? 'Manage your account profile, authentication, and security preferences.' 
                  : 'Log in or create an account to sync your portfolio.'}
              </p>
            </div>
            
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
              {isLoggedIn ? (
                <div className="space-y-8">
                  {/* Profile Block */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Profile</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg">
                            {user?.email?.[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[15px] font-bold text-black">{user?.email?.split('@')[0]}</div>
                            <div className="text-[13px] text-gray-500 font-medium">{user?.email}</div>
                          </div>
                        </div>
                        <button 
                          onClick={handleSignOut}
                          className="text-[13px] font-bold text-rose-500 border border-rose-100 bg-white hover:bg-rose-50 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                        >
                          Sign Out
                        </button>
                      </div>
                      <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100 flex items-start space-x-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                        <div>
                          <div className="text-[13px] font-bold text-emerald-700">Account Verified</div>
                          <div className="text-[12px] text-emerald-600/80 font-medium mt-0.5">Your data is securely synchronized with Supabase Cloud.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Login Credentials */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Login Credentials</h3>
                    <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300">
                      
                      {/* Email Row */}
                      <div className="border-b border-gray-100 bg-white sm:bg-transparent">
                        <div className="px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Mail className="w-4 h-4 text-gray-400" /></div>
                            <div>
                              <div className="text-[14px] font-bold text-black leading-tight">Email Address</div>
                              <div className="text-[13px] text-gray-500 font-medium mt-0.5">{user?.email}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setIsEditingEmail(!isEditingEmail);
                              setIsEditingPassword(false);
                              setAuthError(null);
                              setEmailSuccess(false);
                              setNewEmail('');
                            }}
                            className={`text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                              isEditingEmail 
                                ? 'bg-gray-100 border-gray-200 text-gray-700' 
                                : 'bg-white border-gray-100 text-black hover:bg-gray-100'
                            }`}
                          >
                            {isEditingEmail ? 'Cancel' : 'Change'}
                          </button>
                        </div>
                        
                        {/* Expandable Email Editor */}
                        <div className={`grid transition-all duration-300 ease-in-out ${isEditingEmail ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="p-5 bg-white border-t border-gray-100/60 space-y-4">
                              <form onSubmit={handleUpdateEmail} className="space-y-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">New Email Address</label>
                                  <input 
                                    type="email" 
                                    required
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="Enter your new email"
                                    className="w-full px-4 py-2.5 bg-gray-50/50 rounded-xl text-[14px] text-black font-medium border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-gray-400"
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
                                  className="w-full bg-black text-white text-[13px] font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
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
                      <div className="bg-white sm:bg-transparent">
                        <div className="px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Lock className="w-4 h-4 text-gray-400" /></div>
                            <div>
                              <div className="text-[14px] font-bold text-black leading-tight">Password</div>
                              <div className="text-[13px] text-gray-500 font-medium mt-0.5 tracking-widest mt-1">••••••••</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setIsEditingPassword(!isEditingPassword);
                              setIsEditingEmail(false);
                              setAuthError(null);
                              setPasswordSuccess(false);
                              setNewPassword('');
                              setConfirmPassword('');
                            }}
                            className={`text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border ${
                              isEditingPassword 
                                ? 'bg-gray-100 border-gray-200 text-gray-700' 
                                : 'bg-white border-gray-100 text-black hover:bg-gray-100'
                            }`}
                          >
                            {isEditingPassword ? 'Cancel' : 'Update'}
                          </button>
                        </div>
                        
                        {/* Expandable Password Editor */}
                        <div className={`grid transition-all duration-300 ease-in-out ${isEditingPassword ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="p-5 bg-white border-t border-gray-100/60 space-y-4">
                              <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">New Password</label>
                                  <div className="relative">
                                    <input 
                                      type={showPassword ? "text" : "password"} 
                                      required
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      placeholder="Enter new password"
                                      className="w-full px-4 py-2.5 bg-gray-50/50 rounded-xl text-[14px] text-black font-medium border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-gray-400"
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Confirm New Password</label>
                                  <input 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full px-4 py-2.5 bg-gray-50/50 rounded-xl text-[14px] text-black font-medium border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-gray-400"
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
                                  className="w-full bg-black text-white text-[13px] font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
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
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Access Control</h3>
                    <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-gray-400" /></div>
                          <div>
                            <div className="text-[14px] font-bold text-black leading-tight">Two-Factor Auth</div>
                            <div className="text-[13px] text-gray-500 font-medium mt-0.5">Disabled</div>
                          </div>
                        </div>
                        <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Enable</button>
                      </div>
                      <div className="px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Fingerprint className="w-4 h-4 text-gray-400" /></div>
                          <div>
                            <div className="text-[14px] font-bold text-black leading-tight">Passkeys</div>
                            <div className="text-[12px] text-gray-400 font-medium mt-0.5">FaceID / TouchID</div>
                          </div>
                        </div>
                        <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Setup</button>
                      </div>
                    </div>
                  </div>

                  {/* API Management */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">API Management</h3>
                    <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Key className="w-4 h-4 text-gray-400" /></div>
                          <div>
                            <div className="text-[14px] font-bold text-black leading-tight">Finnhub API Key</div>
                            <div className="text-[13px] text-gray-500 font-medium mt-0.5 tracking-widest mt-1">••••••••••••</div>
                          </div>
                        </div>
                        <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Manage</button>
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
            <p className="text-[11px] text-gray-400 font-medium">
              Folio v1.0.0
            </p>
          </div>

        </div>

        {/* Right Spacer for physical centering */}
        <div className="hidden md:block w-64 flex-shrink-0 invisible pointer-events-none"></div>
      </main>
    </div>
  );
}