'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, Trash2, Check, X } from 'lucide-react';

interface Portfolio {
  id: string;
  name: string;
}

interface PortfolioSwitcherProps {
  portfolios: Portfolio[];
  currentId: string;
  variant?: 'header' | 'title';
}

export default function PortfolioSwitcher({ portfolios, currentId, variant = 'header' }: PortfolioSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [localPortfolios, setLocalPortfolios] = useState(portfolios);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = localPortfolios.find(p => p.id === currentId) ?? localPortfolios[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function switchTo(id: string) {
    console.log('switchTo called with id:', id);
    setOpen(false);
    setCreating(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('pid', id);
    console.log('Navigating to:', `/?${params.toString()}`);
    router.push(`/?${params.toString()}`);
  }

  async function handleCreate() {
    if (!newName.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const { portfolio } = await res.json();
      setLocalPortfolios(prev => [...prev, portfolio]);
      setCreating(false);
      setNewName('');
      switchTo(portfolio.id);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (localPortfolios.length <= 1) return;
    if (!confirm('Delete this portfolio and all its transactions?')) return;
    try {
      const res = await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      const remaining = localPortfolios.filter(p => p.id !== id);
      setLocalPortfolios(remaining);
      if (id === currentId) {
        switchTo(remaining[0].id);
      } else {
        router.refresh();
      }
    } catch {
      // silent
    }
  }

  const isTitle = variant === 'title';

  const trigger = (
    <button
      onClick={() => setOpen(o => !o)}
      className={`group flex items-center gap-2 transition-all outline-none rounded-xl ${
        isTitle 
          ? 'px-2 py-1 -ml-2' 
          : 'px-2.5 py-1 rounded-md'
      } ${open ? 'bg-black/5 ring-4 ring-black/5' : 'hover:bg-black/5'}`}
    >
      <span className={isTitle 
        ? 'text-[28px] font-bold text-primary tracking-tight leading-none' 
        : 'text-[13px] font-semibold text-secondary group-hover:text-primary max-w-[140px] truncate'
      }>
        {current?.name ?? 'Portfolio'}
      </span>
      <ChevronDown className={`${
        isTitle ? 'w-5 h-5 text-secondary' : 'w-3.5 h-3.5 text-secondary'
      } transition-transform duration-300 ${open ? 'rotate-180 text-primary' : 'group-hover:text-primary'}`} />
    </button>
  );

  const menuItems = (
    <>
      <div className="max-h-[300px] overflow-y-auto no-scrollbar py-1" style={{ pointerEvents: 'auto' }}>
        {localPortfolios.map(p => (
          <div
            key={p.id}
            onClick={(e) => {
              console.log('Portfolio item clicked:', p.id, p.name);
              e.preventDefault();
              e.stopPropagation();
              switchTo(p.id);
            }}
            onTouchEnd={(e) => {
              console.log('Portfolio item touched:', p.id, p.name);
              e.preventDefault();
              e.stopPropagation();
              switchTo(p.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchTo(p.id);
              }
            }}
            role="button"
            tabIndex={0}
            className="w-full flex items-center justify-between px-4 py-3 sm:py-2.5 hover:bg-element-hover active:bg-element-hover cursor-pointer group/item transition-colors touch-manipulation outline-none"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                p.id === currentId
                  ? 'border-primary bg-primary text-on-primary scale-110'
                  : 'border-border group-hover/item:border-gray-400'
              }`}>
                {p.id === currentId && <Check className="w-2.5 h-2.5" />}
              </div>
              <span className={`text-[15px] sm:text-[13px] font-semibold truncate ${
                p.id === currentId ? 'text-primary' : 'text-secondary group-hover/item:text-primary'
              }`}>{p.name}</span>
            </div>
            {localPortfolios.length > 1 && (
              <button
                onClick={(e) => {
                  console.log('Delete button clicked for:', p.id);
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(p.id, e);
                }}
                className="opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 p-1 rounded-lg text-secondary hover:text-rose-500 hover:bg-rose-50/50 transition-all"
              >
                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border/60 p-1" style={{ pointerEvents: 'auto' }}>
        {creating ? (
          <div className="px-3 py-2 flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
              }}
              placeholder="Portfolio name"
              className="flex-1 text-[15px] sm:text-[13px] bg-transparent border-b border-border outline-none text-primary placeholder:text-secondary py-1"
              style={{ pointerEvents: 'auto' }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || loading}
              className="text-[13px] font-bold text-primary disabled:opacity-40 px-2 py-1"
              style={{ pointerEvents: 'auto' }}
            >
              {loading ? '...' : 'Add'}
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              console.log('New portfolio button clicked');
              e.preventDefault();
              e.stopPropagation();
              setCreating(true);
            }}
            onTouchEnd={(e) => {
              console.log('New portfolio button touched');
              e.preventDefault();
              e.stopPropagation();
              setCreating(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 text-[14px] sm:text-[13px] font-semibold text-secondary hover:text-primary hover:bg-element-hover rounded-lg transition-colors"
            style={{ pointerEvents: 'auto' }}
          >
            <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            New portfolio
          </button>
        )}
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
      {mounted && open && createPortal(
        <div
          className="sm:hidden fixed inset-0 z-[9999] flex items-end justify-center"
          style={{ pointerEvents: 'auto' }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              console.log('Overlay clicked - closing');
              setOpen(false);
              setCreating(false);
            }}
            style={{ pointerEvents: 'auto' }}
          />
          <div
            className="relative w-full bg-card rounded-t-[32px] shadow-2xl overflow-hidden border-t border-border max-h-[80vh]"
            onClick={(e) => {
              console.log('Bottom sheet container clicked');
              e.stopPropagation();
            }}
            style={{ pointerEvents: 'auto' }}
          >
            {/* Grab Handle */}
            <div
              className="w-12 h-1.5 bg-border/60 rounded-full mx-auto mt-3 mb-1"
              onClick={(e) => {
                console.log('Grab handle clicked');
                e.stopPropagation();
              }}
              style={{ pointerEvents: 'auto' }}
            />

            <div
              className="px-6 py-4 flex items-center justify-between"
              onClick={(e) => {
                console.log('Header clicked');
                e.stopPropagation();
              }}
              style={{ pointerEvents: 'auto' }}
            >
              <h3 className="text-[17px] font-bold text-primary">Switch Portfolio</h3>
              <button
                onClick={(e) => {
                  console.log('Close button clicked');
                  e.stopPropagation();
                  setOpen(false);
                  setCreating(false);
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
