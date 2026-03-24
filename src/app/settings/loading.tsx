import React from 'react';
import { ChevronLeft, Wallet, Settings, Bell, UserCircle, Download, Plus } from 'lucide-react';

function PortfolioRowSkeleton() {
  return (
    <div className="px-5 py-4 flex items-center justify-between bg-card sm:bg-transparent">
      <div className="flex items-center space-x-4 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm" />
        <div className="min-w-0">
          <div className="h-4 w-24 bg-border rounded mb-2" />
          <div className="h-3 w-12 bg-border rounded" />
        </div>
      </div>
      <div className="h-8 w-14 bg-border rounded-lg" />
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-page text-primary font-sans antialiased flex flex-col">
      <header className="bg-card/80 backdrop-blur-xl border-b border-border px-4 sm:px-6 h-[56px] flex items-center sticky top-0 z-50 transition-all">
        <div className="flex items-center space-x-2 text-[14px] font-semibold text-secondary">
          <div className="w-6 h-6 rounded-full bg-element-hover flex items-center justify-center">
            <ChevronLeft className="w-3.5 h-3.5 text-secondary" />
          </div>
          <span>Back to Dashboard</span>
        </div>
      </header>

      <main className="flex-1 w-full py-6 md:py-12 flex flex-col md:flex-row justify-center items-start px-4 sm:px-6 gap-8 md:gap-12 relative animate-pulse">
        <aside className="hidden md:block w-64 flex-shrink-0 md:sticky md:top-28">
          <h1 className="text-[24px] md:text-[28px] font-bold text-primary tracking-tight mb-6 md:mb-8 pl-4">Settings</h1>
          <nav className="flex flex-col space-y-1.5">
            {[
              { name: 'Portfolio', icon: <Wallet className="w-4 h-4" /> },
              { name: 'Preferences', icon: <Settings className="w-4 h-4" /> },
              { name: 'Notifications', icon: <Bell className="w-4 h-4" /> },
              { name: 'Account', icon: <UserCircle className="w-4 h-4" /> },
            ].map((item, i) => (
              <div 
                key={i}
                className={`flex items-center space-x-3 px-4 py-3.5 rounded-[14px] border border-transparent ${i === 0 ? 'bg-card shadow-sm' : ''}`}
              >
                <div className="text-secondary">
                  {item.icon}
                </div>
                <div className="h-4 w-24 bg-border rounded"></div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="w-full max-w-[720px] pb-32">
          <div className="md:hidden mb-8 px-1">
            <h1 className="text-[32px] font-bold text-primary tracking-tight">Settings</h1>
          </div>

          <div className="mb-6">
            <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">Portfolio Management</h2>
            <p className="text-[13px] text-secondary font-medium mt-1">Create, edit, and remove your portfolios from one place.</p>
          </div>

          <div className="space-y-6 bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border mb-12 md:mb-16">
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Portfolios</h3>
              <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border/60">
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center">
                      <Plus className="w-4 h-4 text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-primary leading-tight">Create Portfolio</div>
                      <div className="text-[12px] text-secondary font-medium mt-0.5 leading-snug">
                        Add a new portfolio for a different account, strategy, or goal.
                      </div>
                    </div>
                  </div>
                  <div className="h-8 w-16 bg-border rounded-lg" />
                </div>
              </div>
              <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                <div className="divide-y divide-border/60">
                  <PortfolioRowSkeleton />
                  <PortfolioRowSkeleton />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Data Management</h3>
              <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center">
                      <Download className="w-4 h-4 text-secondary" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-primary leading-tight">Export Data</div>
                      <div className="text-[12px] text-secondary font-medium mt-0.5 leading-snug">Download your transaction history</div>
                    </div>
                  </div>
                  <div className="h-8 w-16 bg-border rounded-lg" />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-[18px] md:text-[20px] font-bold text-primary tracking-tight">Preferences</h2>
          </div>
          <div className="space-y-6 bg-card rounded-2xl md:rounded-[32px] p-5 md:p-8 shadow-sm border border-border mb-12 md:mb-16">
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] pl-1">Appearance</h3>
              <div className="bg-element/50 rounded-2xl border border-border overflow-hidden">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className={`px-4 md:px-5 py-4 flex items-center justify-between ${item !== 3 ? 'border-b border-border' : ''}`}
                  >
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm" />
                      <div>
                        <div className="h-4 w-28 bg-border rounded mb-2" />
                        <div className="h-3 w-24 bg-border rounded" />
                      </div>
                    </div>
                    <div className="h-8 w-16 bg-border rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        <div className="hidden md:block w-64 flex-shrink-0 invisible pointer-events-none"></div>
      </main>
    </div>
  );
}
