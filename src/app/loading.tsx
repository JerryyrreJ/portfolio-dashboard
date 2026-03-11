import React from 'react';
import { Search, User, TrendingUp, Plus, RefreshCw } from 'lucide-react';

export default function DashboardLoading() {
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
            <div className="text-black border-b-2 border-black py-[16px]">Investments</div>
            <div className="py-[16px]">Transactions</div>
            <div className="py-[16px]">History</div>
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

      {/* Main Skeleton Content */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 animate-pulse">
        
        {/* Title & Buttons */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-baseline space-x-3">
            <div className="h-8 w-32 sm:w-48 bg-gray-200 rounded-lg"></div>
            <div className="hidden sm:inline-block h-5 w-16 bg-gray-200 rounded-md"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
            <div className="w-20 sm:w-24 h-8 bg-gray-200 rounded-lg"></div>
          </div>
        </div>

        {/* Top Grid: Metrics + Chart */}
        <div className="grid grid-cols-12 gap-5 mb-5">
          
          {/* Left Metrics */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm h-[116px]">
              <div className="h-3 w-24 bg-gray-200 rounded mb-3"></div>
              <div className="h-8 w-32 bg-gray-200 rounded mb-3"></div>
              <div className="flex space-x-2">
                <div className="h-5 w-12 bg-gray-200 rounded"></div>
                <div className="h-5 w-16 bg-gray-200 rounded"></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm h-[100px]">
              <div className="h-3 w-20 bg-gray-200 rounded mb-3"></div>
              <div className="h-7 w-28 bg-gray-200 rounded mb-3"></div>
              <div className="h-3 w-24 bg-gray-200 rounded"></div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm h-[88px] flex items-center justify-between">
              <div>
                <div className="h-3 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-7 w-10 bg-gray-200 rounded"></div>
              </div>
              <div className="flex -space-x-1.5">
                <div className="w-7 h-7 rounded-full bg-gray-200 border border-white"></div>
                <div className="w-7 h-7 rounded-full bg-gray-200 border border-white"></div>
                <div className="w-7 h-7 rounded-full bg-gray-200 border border-white"></div>
              </div>
            </div>
          </div>

          {/* Right Chart */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
                <div>
                  <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 w-40 bg-gray-200 rounded"></div>
                </div>
                <div className="flex space-x-1 w-full sm:w-auto">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex-1 sm:flex-none w-auto sm:w-8 h-6 sm:h-7 bg-gray-200 rounded-md"></div>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-gray-100/50 rounded-xl w-full h-[200px]"></div>
              <div className="flex space-x-4 mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                    <div className="h-3 w-12 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Holdings Table Skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
            <div className="h-4 w-40 bg-gray-200 rounded"></div>
            <div className="h-3 w-24 bg-gray-200 rounded"></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-3"><div className="h-3 w-12 bg-gray-200 rounded"></div></th>
                  <th className="px-6 py-3 hidden md:table-cell"><div className="h-3 w-20 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-3 hidden sm:table-cell"><div className="h-3 w-16 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-3"><div className="h-3 w-12 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-3"><div className="h-3 w-20 bg-gray-200 rounded ml-auto"></div></th>
                  <th className="px-6 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {[1, 2, 3, 4, 5].map((row) => (
                  <tr key={row}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                        <div>
                          <div className="h-4 w-12 sm:w-16 bg-gray-200 rounded mb-1"></div>
                          <div className="h-3 w-20 sm:w-24 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell"><div className="h-4 w-16 bg-gray-200 rounded ml-auto"></div></td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-12 bg-gray-200 rounded mb-1"></div>
                        <div className="h-3 w-10 bg-gray-200 rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-20 bg-gray-200 rounded mb-1"></div>
                        <div className="h-3 w-16 bg-gray-200 rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end">
                        <div className="h-4 w-12 bg-gray-200 rounded mb-1"></div>
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