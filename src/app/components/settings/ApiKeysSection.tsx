'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type CreatedApiKey = ApiKeySummary & {
  secret: string;
};

function maskKey(prefix: string, lastFour: string) {
  return `${prefix}••••${lastFour}`;
}

export default function ApiKeysSection() {
  const t = useTranslations('settings.apiKeys');
  const locale = useLocale();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const loadKeys = useCallback(async () => {
    const response = await fetch('/api/settings/api-keys');
    if (!response.ok) {
      throw new Error(t('loadFailed'));
    }
    const data = await response.json() as { keys?: ApiKeySummary[] };
    setKeys(data.keys ?? []);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void loadKeys()
      .catch(() => {
        if (!cancelled) setError(t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadKeys, t]);

  useEffect(() => {
    if (createOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [createOpen]);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() || undefined }),
      });
      const data = await response.json() as { key?: CreatedApiKey; error?: { message?: string } };
      if (!response.ok || !data.key?.secret) {
        throw new Error(data.error?.message || t('createFailed'));
      }
      setCreatedKey(data.key);
      setNewName('');
      setCreateOpen(false);
      setCopied(false);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('copyFailed'));
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setError(null);
    const previous = keys;
    setKeys((current) => current.filter((key) => key.id !== id));
    try {
      const response = await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(data.error?.message || t('revokeFailed'));
      }
      if (createdKey?.id === id) {
        setCreatedKey(null);
      }
    } catch (err) {
      setKeys(previous);
      setError(err instanceof Error ? err.message : t('revokeFailed'));
    } finally {
      setRevokingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 md:px-5 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <div className="text-[14px] font-bold text-primary leading-tight">{t('title')}</div>
            <div className="text-[12px] text-secondary font-medium mt-0.5">{t('subtitle')}</div>
          </div>
        </div>
        <Loader2 className="w-4 h-4 animate-spin text-secondary" />
      </div>
    );
  }

  const hasKeys = keys.length > 0;

  return (
    <div className="select-none">
      <div className="px-4 md:px-5 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 md:space-x-4 min-w-0 mr-3">
          <div className={`w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center shrink-0 transition-all duration-300 ${isOpen ? 'scale-110 border-border ring-4 ring-black/5' : ''}`}>
            <KeyRound className={`w-4 h-4 transition-colors duration-300 ${isOpen ? 'text-primary' : 'text-secondary'}`} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-primary leading-tight">{t('title')}</div>
            <div className="text-[12px] text-secondary font-medium mt-0.5">
              {hasKeys ? t('activeCount', { count: keys.length }) : t('empty')}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setCreateOpen(false);
            setError(null);
          }}
          className={`shrink-0 text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 border ${
            isOpen
              ? 'bg-element-hover border-border text-secondary'
              : 'bg-card border-border text-primary hover:bg-element-hover'
          }`}
        >
          {isOpen ? t('done') : t('manage')}
        </button>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-border/60">
            {createdKey && (
              <div className="mx-4 md:mx-5 mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] text-amber-800 font-bold leading-tight">{t('createdTitle')}</p>
                    <p className="text-[12px] text-amber-700/80 font-medium mt-1">{t('createdWarning')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 px-3 py-2 bg-white/80 border border-amber-100 rounded-lg text-[12px] font-mono text-primary truncate select-text">
                    {createdKey.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdKey.secret)}
                    className="shrink-0 text-[12px] font-bold text-primary border border-border bg-card hover:bg-element-hover px-3 py-2 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t('copied') : t('copy')}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mx-4 md:mx-5 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-rose-600/80 dark:text-rose-400/80 font-medium leading-tight">{error}</p>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {keys.map((key) => (
                <div key={key.id} className="px-4 md:px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-primary leading-tight">{key.name}</div>
                    <div className="text-[11px] text-secondary font-medium mt-0.5 font-mono truncate">
                      {maskKey(key.prefix, key.lastFour)}
                    </div>
                    <div className="text-[11px] text-secondary font-medium mt-0.5">
                      <span>{t('createdOn', { date: dateFormatter.format(new Date(key.createdAt)) })}</span>
                      {key.lastUsedAt && (
                        <>
                          <span className="hidden sm:inline"> · </span>
                          <span className="block sm:inline">{t('lastUsed', { date: dateFormatter.format(new Date(key.lastUsedAt)) })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(key.id)}
                    disabled={revokingId === key.id}
                    className="shrink-0 text-[12px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/15 px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {revokingId === key.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {t('revoke')}
                  </button>
                </div>
              ))}
              {!hasKeys && !createOpen && (
                <div className="px-4 md:px-5 py-4 text-[13px] text-secondary font-medium">
                  {t('emptyHint')}
                </div>
              )}
            </div>

            <div className="px-4 md:px-5 py-4 border-t border-border">
              {!createOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(true);
                    setError(null);
                  }}
                  className="w-full text-[13px] font-bold text-primary border border-border bg-element hover:bg-element-hover py-2.5 rounded-xl transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('create')}
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">
                      {t('nameLabel')}
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
                      placeholder={t('namePlaceholder')}
                      maxLength={80}
                      className="w-full px-4 py-2.5 bg-element/50 rounded-xl text-[14px] text-primary font-medium border border-border focus:border-primary focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-secondary select-text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateOpen(false);
                        setNewName('');
                        setError(null);
                      }}
                      className="flex-1 text-[13px] font-bold py-2.5 rounded-xl border border-border bg-element text-gray-700 hover:bg-element-hover transition-colors active:scale-[0.98]"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCreate()}
                      disabled={isCreating}
                      className="flex-1 bg-primary text-on-primary text-[13px] font-bold py-2.5 rounded-xl hover:bg-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isCreating ? t('creating') : t('create')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
