'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X, Settings2 } from 'lucide-react';
import { useHydrated } from '@/lib/useHydrated';
import {
  applyPortfolioSelectionToSearchParams,
  buildPortfolioSelectionLabel,
} from '@/lib/portfolio-selection';

interface Portfolio {
  id: string;
  name: string;
}

interface PortfolioSwitcherProps {
  portfolios: Portfolio[];
  selectedIds: string[];
  variant?: 'header' | 'title';
}

export default function PortfolioSwitcher({ portfolios, selectedIds, variant = 'header' }: PortfolioSwitcherProps) {
  const t = useTranslations('portfolioSwitcher');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draftSelection, setDraftSelection] = useState<string[]>(selectedIds);
  const ref = useRef<HTMLDivElement>(null);
  const isHydrated = useHydrated();

  useEffect(() => {
    setDraftSelection(selectedIds);
  }, [selectedIds]);

  const currentLabel = buildPortfolioSelectionLabel(
    {
      portfolioIds: selectedIds,
      primaryPortfolioId: selectedIds[0] ?? null,
      mode: selectedIds.length > 1 ? 'multi' : 'single',
      isAllSelected: portfolios.length > 0 && selectedIds.length === portfolios.length,
      canWrite: selectedIds.length === 1,
      selectedCount: selectedIds.length,
      rawRequestedIds: selectedIds,
    },
    portfolios,
    {
      allLabel: 'All Portfolios',
      countLabel: (count) => `${count} Portfolios`,
    },
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function applySelection(ids: string[]) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    applyPortfolioSelectionToSearchParams(params, ids);
    router.push(`/app?${params.toString()}`);
  }

  function toggleSelection(id: string) {
    setDraftSelection((current) => {
      if (current.includes(id)) {
        const next = current.filter((selectedId) => selectedId !== id);
        return next.length > 0 ? next : current;
      }
      return portfolios
        .map((portfolio) => portfolio.id)
        .filter((portfolioId) => portfolioId === id || current.includes(portfolioId));
    });
  }

  function selectAll() {
    setDraftSelection(portfolios.map((portfolio) => portfolio.id));
  }

  function selectOnly(id: string) {
    setDraftSelection([id]);
  }

  function goToManagePortfolios() {
    setOpen(false);
    const params = new URLSearchParams();
    if (selectedIds.length === 1 && selectedIds[0] && selectedIds[0] !== 'local-portfolio') {
      params.set('pid', selectedIds[0]);
    }
    const query = params.toString();
    router.push(`/settings${query ? `?${query}` : ''}#portfolio`);
  }

  const isTitle = variant === 'title';

  const trigger = (
    <button
      onClick={() => setOpen(o => !o)}
      className={`group flex items-center gap-2 transition-all outline-none rounded-xl ${
        isTitle 
          ? 'px-2 py-1 -ml-2 text-left' 
          : 'px-2.5 py-1 rounded-md'
      } ${open ? 'bg-black/5 ring-4 ring-black/5' : 'hover:bg-black/5'}`}
    >
      <span className={isTitle 
        ? 'text-[24px] sm:text-[28px] font-bold text-primary tracking-tight leading-tight' 
        : 'text-[13px] font-semibold text-secondary group-hover:text-primary max-w-[140px] truncate'
      }>
        {currentLabel || t('fallback')}
      </span>
      <ChevronDown className={`${
        isTitle ? 'w-5 h-5 text-secondary shrink-0' : 'w-3.5 h-3.5 text-secondary shrink-0'
      } transition-transform duration-300 ${open ? 'rotate-180 text-primary' : 'group-hover:text-primary'}`} />
    </button>
  );

  const menuItems = (
    <>
      <div className="max-h-[300px] overflow-y-auto no-scrollbar py-1" style={{ pointerEvents: 'auto' }}>
        {portfolios.length > 1 && (
          <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between gap-2">
            <button
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                selectAll();
              }}
              className="text-[12px] font-semibold text-secondary hover:text-primary transition-colors"
            >
              Select All
            </button>
            <button
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                applySelection(draftSelection);
              }}
              className="px-3 py-1 rounded-lg bg-primary text-on-primary text-[12px] font-semibold"
            >
              Apply
            </button>
          </div>
        )}
        {portfolios.map(p => (
          <div
            key={p.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSelection(p.id);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSelection(p.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSelection(p.id);
              }
            }}
            role="button"
            tabIndex={0}
            className="w-full flex items-center justify-between px-4 py-3 sm:py-2.5 hover:bg-element-hover active:bg-element-hover cursor-pointer group/item transition-colors touch-manipulation outline-none"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                draftSelection.includes(p.id)
                  ? 'border-primary bg-primary text-on-primary scale-110'
                  : 'border-border group-hover/item:border-gray-400'
              }`}>
                {draftSelection.includes(p.id) && <Check className="w-2.5 h-2.5" />}
              </div>
              <span className={`text-[15px] sm:text-[13px] font-semibold truncate ${
                draftSelection.includes(p.id) ? 'text-primary' : 'text-secondary group-hover/item:text-primary'
              }`}>{p.name}</span>
            </div>
            <button
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                selectOnly(p.id);
                applySelection([p.id]);
              }}
              className="text-[11px] font-semibold text-secondary hover:text-primary transition-colors"
            >
              Only
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60 p-1" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goToManagePortfolios();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goToManagePortfolios();
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 text-[14px] sm:text-[13px] font-semibold text-secondary hover:text-primary hover:bg-element-hover rounded-lg transition-colors"
          style={{ pointerEvents: 'auto' }}
        >
          <Settings2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          {t('manage')}
        </button>
      </div>
    </>
  );

  return (
    <div ref={ref} className="relative inline-block">
      {trigger}

      {/* Desktop Dropdown */}
      {open && (
        <div className="hidden sm:block absolute left-0 top-full mt-2 w-64 bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {menuItems}
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {isHydrated && open && createPortal(
        <div
          className="sm:hidden fixed inset-0 z-[9999] flex items-end justify-center"
          style={{ pointerEvents: 'auto' }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            style={{ pointerEvents: 'auto' }}
          />
          <div
            className="relative w-full bg-card rounded-t-[32px] shadow-2xl overflow-hidden border-t border-border max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            {/* Grab Handle */}
            <div
              className="w-12 h-1.5 bg-border/60 rounded-full mx-auto mt-3 mb-1"
              onClick={(e) => e.stopPropagation()}
              style={{ pointerEvents: 'auto' }}
            />

            <div
              className="px-6 py-4 flex items-center justify-between"
              onClick={(e) => e.stopPropagation()}
              style={{ pointerEvents: 'auto' }}
            >
              <h3 className="text-[17px] font-bold text-primary">{t('mobileTitle')}</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-element-hover flex items-center justify-center text-secondary"
                style={{ pointerEvents: 'auto' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="pb-8" style={{ pointerEvents: 'auto' }}>
              {menuItems}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
