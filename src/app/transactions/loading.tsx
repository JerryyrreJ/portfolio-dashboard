import React from 'react';
import { Search, User, TrendingUp, ChevronRight } from 'lucide-react';

export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">
      {/* Header - Matches exactly */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight opacity-50">
              <div className="bg-black text-white p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Folio</span>
            </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-300">
            <div className="py-[16px]">Investments</div>
            <div className="text-black border-b-2 border-black py-[16px]">Transactions</div>
            <div className="py-[16px]">History</div>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative">
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

      {/* Main Skeleton Content */}
      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
        
        {/* Breadcrumbs & Title Area */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 sm:mb-8">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3 w-16 bg-gray-200 rounded"></div>
              <ChevronRight className="w-3 h-3 text-gray-200" />
              <div className="h-3 w-20 bg-gray-200 rounded"></div>
            </div>
            <div className="h-9 w-64 bg-gray-200 rounded-lg mb-2"></div>
            <div className="h-4 w-48 bg-gray-100 rounded"></div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-9 flex-1 sm:w-24 bg-gray-200 rounded-full"></div>
            <div className="h-9 flex-1 sm:w-24 bg-gray-200 rounded-full"></div>
          </div>
        </div>

        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
              <div className="h-3 w-20 bg-gray-100 rounded mb-2"></div>
              <div className="h-6 w-24 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>

        {/* Transactions Table Skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4"><div className="h-3 w-24 bg-gray-200 rounded"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-32 bg-gray-200 rounded"></div></th>
                  <th className="px-6 py-4 text-center"><div className="h-3 w-12 bg-gray-200 rounded mx-auto"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-16 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-20 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-24 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-4 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                  <tr key={row}>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 rounded mb-1.5"></div>
                      <div className="h-3 w-12 bg-gray-100 rounded"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100"></div>
                        <div>
                          <div className="h-4 w-12 bg-gray-200 rounded mb-1.5"></div>
                          <div className="h-3 w-24 bg-gray-100 rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-12 bg-gray-100 rounded mx-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 rounded ml-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-100 rounded ml-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 rounded ml-auto mb-1.5"></div>
                      <div className="h-3 w-16 bg-gray-100 rounded ml-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <div className="w-7 h-7 bg-gray-50 rounded-md"></div>
                        <div className="w-7 h-7 bg-gray-50 rounded-md"></div>
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
