import React from 'react';
import { History as HistoryIcon, Search, TrendingUp, User } from 'lucide-react';

function Block({ className }: { className: string }) {
  return <div className={`bg-border rounded ${className}`} />;
}

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-page text-primary font-sans antialiased">
      <header className="bg-card/70 backdrop-blur-xl border-b border-border px-6 h-[56px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2 text-primary font-bold text-[17px] tracking-tight opacity-60">
            <div className="bg-primary text-on-primary p-1 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span>Folio</span>
          </div>
          <nav className="hidden md:flex space-x-7 text-[14px] font-semibold text-secondary">
            <div className="text-primary border-b-2 border-primary py-[16px]">Investments</div>
            <div className="py-[16px]">Transactions</div>
          </nav>
        </div>
        <div className="flex items-center space-x-5">
          <div className="hidden sm:block">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-secondary" />
              <div className="bg-element-hover rounded-lg h-8 w-44" />
            </div>
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="sm:hidden w-7 h-7 rounded-full bg-element-hover border border-border flex items-center justify-center text-secondary shadow-sm">
              <Search className="w-3.5 h-3.5" />
            </div>
            <div className="md:hidden w-7 h-7 rounded-full bg-element-hover border border-border flex items-center justify-center text-secondary shadow-sm">
              <HistoryIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-element-hover border border-border flex items-center justify-center text-secondary shadow-sm shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-[13px] font-bold text-secondary hidden sm:block">Guest</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 animate-pulse">
        <div className="flex justify-between items-center mb-6 gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <Block className="h-9 sm:h-10 w-28 sm:w-52 rounded-xl shrink-0" />
            <Block className="hidden sm:inline-block h-6 w-20 rounded-md" />
          </div>
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            <Block className="h-9 w-9 rounded-xl" />
            <Block className="h-9 w-9 sm:w-28 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5 mb-5">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <Block className="h-3 w-28 mb-2" />
              <Block className="h-8 w-36 mb-3 rounded-lg" />
              <div className="flex items-center space-x-2">
                <Block className="h-5 w-14 rounded-md" />
                <Block className="h-4 w-20 rounded-md" />
              </div>
            </div>

            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
              {[1, 2, 3].map((section) => (
                <div key={section}>
                  {section > 1 && <div className="border-t border-border mb-4" />}
                  <Block className="h-3 w-24 mb-2" />
                  <Block className="h-6 w-28 mb-2 rounded-lg" />
                  <Block className="h-3 w-20" />
                </div>
              ))}
            </div>

            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex items-center justify-between">
              <div>
                <Block className="h-3 w-12 mb-2" />
                <Block className="h-7 w-10 rounded-lg" />
              </div>
              <div className="flex -space-x-1.5">
                <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-10" />
                <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-20" />
                <div className="w-7 h-7 rounded-full bg-border border border-card shadow-sm z-30" />
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-9">
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm h-full flex flex-col">
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex flex-row justify-between items-start gap-2">
                  <div>
                    <Block className="h-4 w-36 mb-2" />
                    <Block className="h-3 w-44" />
                  </div>
                  <div className="flex items-center shrink-0">
                    <div className="flex bg-element rounded-lg p-0.5 border border-border gap-1">
                      <Block className="h-7 w-14 rounded-md" />
                      <Block className="h-7 w-14 rounded-md" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[300px] w-full relative">
                <div className="absolute right-0 top-[10px] bottom-[20px] flex flex-col-reverse justify-between items-end pointer-events-none z-10">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <Block key={item} className="h-3 w-8" />
                  ))}
                </div>
                <div className="h-full w-full rounded-xl bg-element-hover/40 border border-border/40" />
              </div>

              <div className="mt-6 flex justify-center">
                <div className="flex bg-element/50 p-1 rounded-2xl gap-1 border border-border/50">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <Block key={item} className="h-8 w-12 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <Block className="h-5 w-36 rounded-md" />
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-element-hover rounded-lg p-0.5 gap-1">
                <Block className="h-7 w-9 rounded-md" />
                <Block className="h-7 w-9 rounded-md" />
              </div>
              <Block className="hidden sm:block h-3 w-24" />
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-element/50 border-b border-border">
                  <th className="px-4 sm:px-6 py-3"><Block className="h-3 w-12" /></th>
                  <th className="px-4 sm:px-6 py-3 text-right hidden md:table-cell"><Block className="h-3 w-20 ml-auto" /></th>
                  <th className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell"><Block className="h-3 w-16 ml-auto" /></th>
                  <th className="px-4 sm:px-6 py-3 text-right"><Block className="h-3 w-12 ml-auto" /></th>
                  <th className="px-4 sm:px-6 py-3 text-right"><Block className="h-3 w-14 ml-auto" /></th>
                  <th className="px-4 sm:px-6 py-3 w-10 hidden sm:table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {[1, 2].map((group) => (
                  <React.Fragment key={group}>
                    <tr className="bg-element/30">
                      <td colSpan={6} className="px-4 sm:px-6 py-2">
                        <Block className="h-3 w-24" />
                      </td>
                    </tr>
                    {[1, 2].map((row) => (
                      <tr key={`${group}-${row}`}>
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-border shrink-0" />
                            <div className="min-w-0">
                              <Block className="h-4 w-14 mb-1" />
                              <Block className="h-3 w-20 sm:w-28" />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 hidden md:table-cell"><Block className="h-4 w-16 ml-auto" /></td>
                        <td className="px-4 sm:px-6 py-3 hidden sm:table-cell">
                          <div className="flex flex-col items-end">
                            <Block className="h-4 w-12 mb-1" />
                            <Block className="h-3 w-10" />
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex flex-col items-end">
                            <Block className="h-4 w-20 mb-1" />
                            <Block className="h-3 w-12 sm:hidden" />
                            <Block className="h-3 w-16 hidden sm:block" />
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex flex-col items-end">
                            <Block className="h-4 w-16 mb-1" />
                            <Block className="h-3 w-16 hidden sm:block" />
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 hidden sm:table-cell">
                          <Block className="h-4 w-4 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-primary/[0.02] border-t border-border">
                  <td className="px-4 sm:px-6 py-4"><Block className="h-4 w-12" /></td>
                  <td className="px-4 sm:px-6 py-4 hidden md:table-cell" />
                  <td className="px-4 sm:px-6 py-4 hidden sm:table-cell" />
                  <td className="px-4 sm:px-6 py-4 text-right"><Block className="h-4 w-24 ml-auto" /></td>
                  <td className="px-4 sm:px-6 py-4 text-right"><Block className="h-4 w-16 ml-auto" /></td>
                  <td className="px-4 sm:px-6 py-4 hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
