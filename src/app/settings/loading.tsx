import React from 'react';
import { ChevronLeft, Wallet, Settings, Bell, UserCircle } from 'lucide-react';

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans antialiased flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 h-[56px] flex items-center sticky top-0 z-50 transition-all">
        <div className="flex items-center space-x-2 text-[14px] font-semibold text-gray-400">
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <span>Back to Dashboard</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full py-12 flex flex-col md:flex-row justify-center items-start px-6 gap-12 relative animate-pulse">
        
        {/* Sidebar Navigation Skeleton */}
        <aside className="w-full md:w-64 flex-shrink-0 md:sticky md:top-28">
          <div className="h-9 w-32 bg-gray-200 rounded-lg mb-8 ml-4"></div>
          <nav className="flex flex-col space-y-1.5">
            {[
              { name: 'Portfolio', icon: <Wallet className="w-4 h-4" /> },
              { name: 'Preferences', icon: <Settings className="w-4 h-4" /> },
              { name: 'Notifications', icon: <Bell className="w-4 h-4" /> },
              { name: 'Account', icon: <UserCircle className="w-4 h-4" /> },
            ].map((item, i) => (
              <div 
                key={i}
                className={`flex items-center space-x-3 px-4 py-3.5 rounded-[14px] border border-transparent ${i === 0 ? 'bg-white shadow-sm' : ''}`}
              >
                <div className="text-gray-300">
                  {item.icon}
                </div>
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content Area Skeleton */}
        <div className="w-full max-w-[720px] pb-32">
          
          {/* Section Skeleton */}
          <div className="mb-6">
            <div className="h-7 w-48 bg-gray-200 rounded-lg mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 rounded"></div>
          </div>
          
          <div className="space-y-6 bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-16">
            <div className="space-y-4">
              <div className="h-3 w-16 bg-gray-200 rounded ml-1"></div>
              <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-6 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm"></div>
                    <div>
                      <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 w-32 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="h-8 w-16 bg-gray-200 rounded-lg"></div>
                </div>
                <div className="px-5 py-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm"></div>
                    <div>
                      <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 w-32 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="h-8 w-16 bg-gray-200 rounded-lg"></div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="h-3 w-28 bg-gray-200 rounded ml-1"></div>
              <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm"></div>
                    <div>
                      <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 w-40 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-gray-200 rounded-lg"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Second Section Skeleton */}
          <div className="mb-6">
            <div className="h-7 w-32 bg-gray-200 rounded-lg mb-2"></div>
          </div>
          <div className="space-y-6 bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-16 h-64"></div>
        </div>

        {/* Right Spacer */}
        <div className="hidden md:block w-64 flex-shrink-0 invisible pointer-events-none"></div>
      </main>
    </div>
  );
}