import React from 'react';
import { Search, TrendingUp, ChevronRight, Plus, BarChart2, Newspaper, History, User } from 'lucide-react';

export default function StockDetailLoading() {
  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">
      {/* Header - Matches Dashboard */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-4 sm:px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight opacity-50">
            <div className="bg-black text-white p-1 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span>Folio</span>
          </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-400">
            <div className="py-[16px]">Investments</div>
            <div className="py-[16px]">Transactions</div>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-gray-400" />
            <div className="bg-gray-100 rounded-lg h-8 w-44"></div>
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
              <User className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-bold text-gray-400 hidden sm:block">Account</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-pulse">
        
        {/* Top Section Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-6 sm:gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-200 border border-gray-100 shadow-sm flex-shrink-0 mt-1 sm:mt-0"></div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 mb-1">
                <div className="h-3 w-16 bg-gray-200 rounded"></div>
                <ChevronRight className="w-3 h-3 text-gray-200" />
                <div className="h-3 w-12 bg-gray-200 rounded"></div>
              </div>
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                <div className="h-8 sm:h-10 w-20 sm:w-24 bg-gray-200 rounded-lg"></div>
                <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
                <div className="h-5 sm:h-6 w-32 sm:w-48 bg-gray-100 rounded-lg mt-1 sm:mt-0"></div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 w-full sm:w-auto bg-white sm:bg-transparent p-4 sm:p-0 rounded-2xl sm:rounded-none border sm:border-none border-gray-100 shadow-sm sm:shadow-none">
            <div className="text-left sm:text-right">
              <div className="flex items-center justify-start sm:justify-end gap-2 sm:gap-3">
                <div className="h-8 sm:h-10 w-32 bg-gray-200 rounded-lg"></div>
                <div className="w-8 h-8 bg-gray-100 rounded-lg border border-gray-100"></div>
              </div>
              <div className="flex items-center justify-start sm:justify-end gap-1.5 mt-2">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <div className="h-5 w-24 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
            <div className="h-10 w-px bg-gray-100 hidden sm:block"></div>
            <div className="h-12 w-32 bg-gray-200 rounded-xl shrink-0"></div>
          </div>
        </div>

        {/* Grid Layout Skeleton */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* Main Content Skeleton */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            
            {/* Chart Skeleton */}
            <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-gray-100 shadow-sm p-4 sm:p-8 h-[360px] sm:h-[480px]">
              <div className="h-5 w-32 bg-gray-200 rounded-lg mb-6 sm:mb-10"></div>
              <div className="h-[280px] sm:h-[340px] w-full bg-gray-50/50 rounded-2xl"></div>
            </div>

            {/* Tabs Skeleton */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-50 px-2 overflow-x-auto no-scrollbar">
                {[BarChart2, Newspaper, History].map((Icon, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 sm:px-6 py-4 opacity-20 shrink-0">
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <div className="h-3 w-16 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
              <div className="p-4 sm:p-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50">
                      <div className="h-3 w-20 bg-gray-100 rounded"></div>
                      <div className="h-4 w-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            
            {/* Position Summary Card Skeleton */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-[320px]">
              <div className="h-3 w-24 bg-gray-100 rounded mb-2"></div>
              <div className="h-10 w-40 bg-gray-200 rounded-lg mb-8"></div>
              <div className="space-y-3">
                <div className="h-10 w-full bg-gray-50/80 rounded-lg border border-gray-100/50"></div>
                <div className="h-10 w-full bg-gray-50/80 rounded-lg border border-gray-100/50"></div>
                <div className="h-20 w-full bg-emerald-50/30 rounded-xl border border-emerald-100/30 mt-2"></div>
              </div>
            </div>

            {/* Stats Card Skeleton */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="h-3 w-32 bg-gray-100 rounded mb-2"></div>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-3 w-20 bg-gray-100 rounded"></div>
                  <div className="h-4 w-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>

            {/* Market Status Bar Skeleton */}
            <div className="bg-gray-100/50 rounded-2xl p-5 border border-gray-100 flex flex-col items-center">
               <div className="h-3 w-24 bg-gray-200 rounded mb-2"></div>
               <div className="h-2 w-32 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
