import React from 'react';
import { Search, User, TrendingUp, ChevronRight } from 'lucide-react';

export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-page text-primary font-sans antialiased">
      {/* Header - Matches exactly */}
      <header className="bg-card/70 backdrop-blur-xl border-b border-border px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2 text-primary font-bold text-[17px] tracking-tight opacity-50">
              <div className="bg-black text-white p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Folio</span>
            </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-secondary">
            <div className="py-[16px]">Investments</div>
            <div className="text-primary border-b-2 border-black py-[16px]">Transactions</div>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative">
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
      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
        
        {/* Breadcrumbs & Title Area */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 sm:mb-8">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3 w-16 bg-border rounded"></div>
              <ChevronRight className="w-3 h-3 text-gray-200" />
              <div className="h-3 w-20 bg-border rounded"></div>
            </div>
            <div className="h-9 w-64 bg-border rounded-lg mb-2"></div>
            <div className="h-4 w-48 bg-element-hover rounded"></div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-9 flex-1 sm:w-24 bg-border rounded-full"></div>
            <div className="h-9 flex-1 sm:w-24 bg-border rounded-full"></div>
          </div>
        </div>

        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm flex flex-col items-center">
              <div className="h-3 w-20 bg-element-hover rounded mb-2"></div>
              <div className="h-6 w-24 bg-border rounded"></div>
            </div>
          ))}
        </div>

        {/* Transactions Table Skeleton */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-element/50 border-b border-border">
                  <th className="px-6 py-4"><div className="h-3 w-24 bg-border rounded"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-32 bg-border rounded"></div></th>
                  <th className="px-6 py-4 text-center"><div className="h-3 w-12 bg-border rounded mx-auto"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-16 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-20 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-24 bg-border rounded ml-auto"></div></th>
                  <th className="px-6 py-4 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                  <tr key={row}>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-border rounded mb-1.5"></div>
                      <div className="h-3 w-12 bg-element-hover rounded"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-element-hover"></div>
                        <div>
                          <div className="h-4 w-12 bg-border rounded mb-1.5"></div>
                          <div className="h-3 w-24 bg-element-hover rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-12 bg-element-hover rounded mx-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-border rounded ml-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-element-hover rounded ml-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-border rounded ml-auto mb-1.5"></div>
                      <div className="h-3 w-16 bg-element-hover rounded ml-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <div className="w-7 h-7 bg-element rounded-md"></div>
                        <div className="w-7 h-7 bg-element rounded-md"></div>
                      </div>
                    </td>
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
