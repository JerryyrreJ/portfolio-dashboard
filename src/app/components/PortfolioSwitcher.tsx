'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react';

interface Portfolio {
  id: string;
  name: string;
}

interface PortfolioSwitcherProps {
  portfolios: Portfolio[];
  currentId: string;
}

export default function PortfolioSwitcher({ portfolios, currentId }: PortfolioSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [localPortfolios, setLocalPortfolios] = useState(portfolios);
  const ref = useRef<HTMLDivElement>(null);

  const current = localPortfolios.find(p => p.id === currentId) ?? localPortfolios[0];

  // 点击外部关闭
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
    const params = new URLSearchParams(window.location.search);
    params.set('pid', id);
    router.push(`/?${params.toString()}`);
    setOpen(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-semibold text-secondary hover:text-primary hover:bg-element-hover transition-colors"
      >
        <span className="max-w-[140px] truncate">{current?.name ?? 'Portfolio'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          {localPortfolios.map(p => (
            <div
              key={p.id}
              onClick={() => switchTo(p.id)}
              className="flex items-center justify-between px-3 py-2 hover:bg-element-hover cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                {p.id === currentId
                  ? <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  : <span className="w-3.5 h-3.5 shrink-0" />
                }
                <span className="text-[13px] font-medium text-primary truncate">{p.name}</span>
              </div>
              {localPortfolios.length > 1 && (
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-secondary hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-border mt-1 pt-1">
            {creating ? (
              <div className="px-3 py-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
                  placeholder="Portfolio name"
                  className="flex-1 text-[13px] bg-transparent border-b border-border outline-none text-primary placeholder:text-secondary py-0.5"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || loading}
                  className="text-[12px] font-semibold text-primary disabled:opacity-40"
                >
                  {loading ? '...' : 'Add'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-secondary hover:text-primary hover:bg-element-hover transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New portfolio
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
