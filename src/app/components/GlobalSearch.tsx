'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Search, X, TrendingUp, History, Loader2, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useStock } from '@/hooks/useStock';

interface GlobalSearchProps {
  onClose?: () => void;
  isMobileOnly?: boolean;
}

export default function GlobalSearch({ onClose, isMobileOnly = false }: GlobalSearchProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{ description: string; displaySymbol: string; symbol: string; type: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { searchStock } = useStock();
  const router = useRouter();

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    
    if (!q.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchStock(q);
        setSearchResults(results.slice(0, 10)); // 移动端可以展示稍多一点
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchStock]);

  const handleSelectStock = (symbol: string) => {
    router.push(`/stock/${symbol}`);
    setSearchQuery('');
    setShowSearchResults(false);
    if (onClose) onClose();
  };

  // 点击外部关闭桌面端搜索下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 移动端全屏模式下的自动聚焦
  useEffect(() => {
    if (isMobileOnly && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMobileOnly]);

  // 移动端全屏搜索视图
  if (isMobileOnly) {
    return (
      <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-300 overflow-hidden">
        {/* 顶部搜索条 */}
        <div className="pt-6 px-5 pb-4 flex items-center gap-4 border-b border-gray-100/50">
          <div className="relative flex-1 group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors">
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-black animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-gray-400 group-focus-within:text-black transition-colors" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search stocks..."
              className="w-full bg-gray-100/80 border-none rounded-2xl py-3 pl-11 pr-4 text-[16px] font-medium outline-none focus:ring-2 focus:ring-black/5 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-300/50 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
          <button 
            onClick={onClose}
            className="text-[16px] font-bold text-black px-1 active:opacity-50 transition-opacity"
          >
            Cancel
          </button>
        </div>

        {/* 结果区域 */}
        <div className="flex-1 overflow-y-auto px-5">
          {!searchQuery && (
            <div className="h-full flex flex-col items-center justify-center pb-20 opacity-50">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-[17px] font-bold text-black tracking-tight mb-2">Search Portfolio</h3>
              <p className="text-[14px] text-gray-500 max-w-[200px] text-center leading-relaxed font-medium">
                Find tickers, company names or market symbols
              </p>
            </div>
          )}
          
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="pt-20 flex flex-col items-center justify-center opacity-50">
              <p className="text-[15px] font-bold text-black tracking-tight">No results for "{searchQuery}"</p>
            </div>
          )}

          <div className="py-4 divide-y divide-gray-50">
            {searchResults.map((r) => (
              <button
                key={r.symbol}
                onClick={() => handleSelectStock(r.symbol)}
                className="w-full flex items-center justify-between py-4 active:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[16px] font-bold text-black tracking-tight">{r.displaySymbol}</span>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md uppercase tracking-widest">{r.type}</span>
                  </div>
                  <div className="text-[13px] text-gray-500 font-medium truncate leading-tight">{r.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 桌面端组件 (保持原有精美样式)
  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
        {isSearching ? (
          <Loader2 className="w-3.5 h-3.5 absolute left-3 top-[10px] text-gray-400 animate-spin" />
        ) : (
          <Search className="w-3.5 h-3.5 absolute left-3 top-[10px] text-gray-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => {
            setIsFocused(true);
            if (searchResults.length > 0) setShowSearchResults(true);
          }}
          placeholder="Search stocks..."
          className={`bg-gray-100 border-none rounded-lg py-1.5 pl-9 pr-4 text-[13px] transition-all duration-300 outline-none ${
            isFocused ? 'w-60 ring-1 ring-black/5 bg-white' : 'w-44'
          }`}
        />
      </div>
      
      {showSearchResults && searchResults.length > 0 && (
        <div className="absolute top-full mt-2 left-0 w-full min-w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {searchResults.map((r) => (
            <button
              key={r.symbol}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectStock(r.symbol);
              }}
              className="w-full flex flex-col px-4 py-2.5 hover:bg-gray-50 transition-colors text-left group/item"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[14px] font-bold text-black tracking-tight">{r.displaySymbol}</span>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest group-hover/item:text-gray-400 transition-colors">{r.type}</span>
              </div>
              <span className="text-[12px] text-gray-500 font-medium truncate w-full">{r.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
