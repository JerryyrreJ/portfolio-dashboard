import React from 'react';
import { Search, User, TrendingUp } from 'lucide-react';

export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased">
      {/* Skeleton Header (Matches exactly) */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2 text-black font-bold text-[17px] tracking-tight opacity-50">
              <div className="bg-black text-white p-1 rounded-md">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span>Folio</span>
            </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-gray-400">
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
      <main className="flex-1 max-w-[1000px] w-full mx-auto px-6 py-8 animate-pulse">
        
        {/* Title Area */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded-lg mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 rounded"></div>
          </div>
          <div className="h-10 w-24 bg-gray-200 rounded-lg"></div>
        </div>

        {/* Filters */}
        <div className="flex space-x-3 mb-6">
          <div className="h-9 w-24 bg-gray-200 rounded-lg"></div>
          <div className="h-9 w-24 bg-gray-200 rounded-lg"></div>
          <div className="h-9 w-32 bg-gray-200 rounded-lg"></div>
        </div>

        {/* Transactions Table Skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4"><div className="h-3 w-12 bg-gray-200 rounded"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-20 bg-gray-200 rounded"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-16 bg-gray-200 rounded"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-16 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-16 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-4"><div className="h-3 w-20 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                  <tr key={row}>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 rounded"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                        <div>
                          <div className="h-4 w-16 bg-gray-200 rounded mb-1"></div>
                          <div className="h-3 w-24 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-16 bg-gray-200 rounded-md"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-16 bg-gray-200 rounded mb-1"></div>
                        <div className="h-3 w-12 bg-gray-200 rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-16 bg-gray-200 rounded mb-1"></div>
                        <div className="h-3 w-12 bg-gray-200 rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-20 bg-gray-200 rounded mb-1"></div>
                        <div className="h-3 w-16 bg-gray-200 rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="w-4 h-4 bg-gray-200 rounded ml-auto"></div></td>
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