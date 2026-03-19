import React from 'react';
import { Search, TrendingUp, User } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-page text-primary font-sans antialiased">
      {/* Skeleton Header (Matches exactly) */}
      <header className="bg-card/70 backdrop-blur-xl border-b border-border px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2 text-primary font-bold text-[17px] tracking-tight opacity-50">
              <div className="bg-black text-white p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Folio</span>
            </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-secondary">
            <div className="text-primary border-b-2 border-black py-[16px]">Investments</div>
            <div className="py-[16px]">Transactions</div>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-secondary" />
            <div className="bg-element-hover rounded-lg h-8 w-44"></div>
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-element-hover border border-border flex items-center justify-center text-secondary shadow-sm shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-[13px] font-bold text-secondary hidden sm:block">Guest</span>
          </div>
        </div>
      </header>

      {/* Main Skeleton Content */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 animate-pulse">
        
        {/* Title & Buttons */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-baseline space-x-3">
            <div className="h-8 w-32 sm:w-48 bg-border rounded-lg"></div>
            <div className="hidden sm:inline-block h-5 w-16 bg-border rounded-md"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-border rounded-lg"></div>
            <div className="w-20 sm:w-24 h-8 bg-border rounded-lg"></div>
          </div>
        </div>

        {/* Top Grid: Metrics + Chart */}
        <div className="grid grid-cols-12 gap-5 mb-5">
          
          {/* Left Metrics */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {/* Portfolio Value Box */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <div className="h-3 w-24 bg-border rounded mb-3"></div>
              <div className="h-8 w-32 bg-border rounded mb-3"></div>
              <div className="flex space-x-2">
                <div className="h-5 w-12 bg-border rounded"></div>
                <div className="h-5 w-16 bg-border rounded"></div>
              </div>
            </div>

            {/* P&L and Dividends Box (3 sections) */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
              {/* Unrealized */}
              <div>
                <div className="h-3 w-20 bg-border rounded mb-2"></div>
                <div className="h-6 w-24 bg-border rounded mb-2"></div>
                <div className="h-2 w-16 bg-border rounded"></div>
              </div>
              <div className="border-t border-border" />
              {/* Realized */}
              <div>
                <div className="h-3 w-16 bg-border rounded mb-2"></div>
                <div className="h-6 w-20 bg-border rounded mb-2"></div>
                <div className="h-2 w-20 bg-border rounded"></div>
              </div>
              <div className="border-t border-border" />
              {/* Dividends */}
              <div>
                <div className="h-3 w-28 bg-border rounded mb-2"></div>
                <div className="h-6 w-16 bg-border rounded mb-2"></div>
                <div className="h-2 w-32 bg-border rounded"></div>
              </div>
            </div>

            {/* Assets Box */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex items-center justify-between">
              <div>
                <div className="h-3 w-12 bg-border rounded mb-2"></div>
                <div className="h-7 w-8 bg-border rounded"></div>
              </div>
              <div className="flex -space-x-1.5">
                <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-10"></div>
                <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-20"></div>
                <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-30"></div>
              </div>
            </div>
          </div>

          {/* Right Chart */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm h-full flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
                <div>
                  <div className="h-4 w-32 bg-border rounded mb-2"></div>
                  <div className="h-3 w-40 bg-border rounded"></div>
                </div>
                {/* 1M 3M 6M 1Y All pill group */}
                <div className="flex bg-element rounded-lg p-0.5 border border-border w-full sm:w-auto h-8 space-x-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex-1 sm:w-10 h-full bg-border/50 rounded-md"></div>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-element-hover/30 rounded-xl w-full h-[300px]"></div>
            </div>
          </div>
        </div>

        {/* Holdings Table Skeleton */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <div className="h-5 w-48 bg-border rounded"></div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="h-6 w-8 bg-border rounded-md"></div>
                <div className="h-6 w-8 bg-border rounded-md"></div>
              </div>
              <div className="h-3 w-24 bg-border rounded hidden sm:block"></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-element/50 border-b border-border">
                  <th className="px-6 py-3"><div className="h-3 w-12 bg-border rounded"></div></th>
                  <th className="px-6 py-3 hidden md:table-cell"><div className="h-3 w-20 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-3 hidden sm:table-cell"><div className="h-3 w-16 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-3"><div className="h-3 w-12 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-3"><div className="h-3 w-20 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-card">
                {[1, 2, 3, 4, 5].map((row) => (
                  <tr key={row}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-border"></div>
                        <div>
                          <div className="h-4 w-12 sm:w-16 bg-border rounded mb-1"></div>
                          <div className="h-3 w-20 sm:w-24 bg-border rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell"><div className="h-4 w-16 bg-border rounded ml-auto"></div></td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-12 bg-border rounded mb-1"></div>
                        <div className="h-3 w-10 bg-border rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-20 bg-border rounded mb-1"></div>
                        <div className="h-3 w-16 bg-border rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-12 bg-border rounded mb-1"></div>
                        <div className="h-3 w-16 bg-border rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="w-4 h-4 bg-border rounded ml-auto"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}