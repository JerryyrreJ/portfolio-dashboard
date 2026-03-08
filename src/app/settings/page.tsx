'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  FileText
} from 'lucide-react';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('portfolio');
  
  // Refs for smooth scrolling and intersection observation
  const portfolioRef = useRef<HTMLDivElement>(null);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'portfolio', name: 'Portfolio', icon: <Wallet className="w-4 h-4" />, ref: portfolioRef },
    { id: 'preferences', name: 'Preferences', icon: <Settings className="w-4 h-4" />, ref: preferencesRef },
    { id: 'security', name: 'Security & Privacy', icon: <Shield className="w-4 h-4" />, ref: securityRef },
    { id: 'notifications', name: 'Notifications', icon: <Bell className="w-4 h-4" />, ref: notificationsRef },
  ];

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
  }, []);

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
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Wallet className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Portfolio Name</div>
                        <div className="text-[13px] text-gray-500 font-medium mt-0.5">Main Account</div>
                      </div>
                    </div>
                    <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Edit</button>
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Globe className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Base Currency</div>
                        <div className="text-[13px] text-gray-500 font-medium mt-0.5">USD ($)</div>
                      </div>
                    </div>
                    <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Change</button>
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

              {/* Danger Group */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-rose-400 uppercase tracking-[0.1em] pl-1">Danger Zone</h3>
                <div className="bg-rose-50/30 rounded-2xl border border-rose-100 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-rose-100 shadow-sm flex items-center justify-center"><Trash2 className="w-4 h-4 text-rose-500" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-rose-600 leading-tight">Wipe Portfolio</div>
                        <div className="text-[12px] text-rose-400/80 font-medium mt-0.5">Permanently delete all data</div>
                      </div>
                    </div>
                    <button className="text-[13px] font-bold text-rose-600 border border-rose-200 bg-white hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Delete</button>
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

          {/* SECTION: SECURITY */}
          <div id="security" ref={securityRef} className="scroll-mt-32">
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-[20px] font-bold text-black tracking-tight">Security & Privacy</h2>
            </div>
            
            <div className="space-y-6 bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-16">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] pl-1">Login Credentials</h3>
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Mail className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Email Address</div>
                        <div className="text-[13px] text-gray-500 font-medium mt-0.5">john.doe@icloud.com</div>
                      </div>
                    </div>
                    <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Change</button>
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center"><Lock className="w-4 h-4 text-gray-400" /></div>
                      <div>
                        <div className="text-[14px] font-bold text-black leading-tight">Password</div>
                        <div className="text-[13px] text-gray-500 font-medium mt-0.5 tracking-widest mt-1">••••••••</div>
                      </div>
                    </div>
                    <button className="text-[13px] font-bold text-black border border-gray-100 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95">Update</button>
                  </div>
                </div>
              </div>
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
          </div>

          {/* SECTION: NOTIFICATIONS */}
          <div id="notifications" ref={notificationsRef} className="scroll-mt-32">
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-[20px] font-bold text-black tracking-tight">Notifications</h2>
            </div>
            
            <div className="space-y-6 bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
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
            
            <div className="mt-12 text-center">
              <button className="text-[14px] font-bold text-rose-500 hover:text-rose-600 transition-colors py-2 px-6 rounded-full hover:bg-rose-50">
                Log Out
              </button>
              <p className="text-[11px] text-gray-400 font-medium mt-4">
                PortfolioUI v1.0.0
              </p>
            </div>
          </div>

        </div>

        {/* Right Spacer for physical centering */}
        <div className="hidden md:block w-64 flex-shrink-0 invisible pointer-events-none"></div>
      </main>
    </div>
  );
}