'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchPortfolioList, invalidatePortfolioListCache, type PortfolioClientRecord } from '@/lib/portfolio-client';

type IdleCallbackHandle = number;
type IdleScheduler = (callback: () => void, timeout?: number) => IdleCallbackHandle;
type IdleCanceler = (handle: IdleCallbackHandle) => void;

export interface Preferences {
  colorScheme: 'Emerald' | 'Rose';
  chartType: 'Area Chart' | 'Line Chart' | 'Bar Chart';
  theme: 'Light' | 'Dark' | 'System';
  hideSmallBalances: boolean;
  realTimeSync: boolean;
  costBasisMethod: 'FIFO' | 'AVCO';
}

const DEFAULT_PREFERENCES: Preferences = {
  colorScheme: 'Emerald',
  chartType: 'Area Chart',
  theme: 'System',
  hideSmallBalances: false,
  realTimeSync: true,
  costBasisMethod: 'FIFO',
};

const LOCAL_KEY = 'user_preferences';
const SETTINGS_UPDATED_AT_KEY = 'settings_updated_at';

function loadLocal(): Preferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

const scheduleIdleTask: IdleScheduler = (callback, timeout = 500) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(() => callback(), { timeout });
  }
  return window.setTimeout(callback, timeout);
};

const cancelIdleTask: IdleCanceler = (handle) => {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(handle);
    return;
  }
  window.clearTimeout(handle);
};

interface UsePreferencesOptions {
  initialPortfolios?: PortfolioClientRecord[];
  cloudSync?: boolean;
}

export function usePreferences(options?: UsePreferencesOptions) {
  const [prefs, setPrefs] = useState<Preferences>(() => loadLocal());
  const initialPortfolios = options?.initialPortfolios;
  const cloudSync = options?.cloudSync ?? true;

  useEffect(() => {
    if (!cloudSync) {
      return;
    }

    // 云端同步（仅登录用户）
    const sync = async () => {
      try {
        const pid = new URLSearchParams(window.location.search).get('pid') ?? '';
        const idParam = pid ? `?id=${pid}` : '';
        const data = initialPortfolios && initialPortfolios.length > 0
          ? { portfolios: initialPortfolios }
          : await fetchPortfolioList();
        const portfolios: PortfolioClientRecord[] = data.portfolios ?? [];
        const portfolio = pid ? portfolios.find((p) => p.id === pid) : portfolios[0];
        if (!portfolio) return;

        const cloudPrefsRaw: string | null = portfolio.preferences ?? null;
        const cloudUpdatedAt: string | null = portfolio.settingsUpdatedAt ?? null;
        const localUpdatedAt = localStorage.getItem(SETTINGS_UPDATED_AT_KEY);

        const cloudMs = cloudUpdatedAt ? new Date(cloudUpdatedAt).getTime() : 0;
        const localMs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;

        if (cloudMs > localMs) {
          // 云端更新，覆盖本地
          const cloudPrefs: Preferences = cloudPrefsRaw
            ? { ...DEFAULT_PREFERENCES, ...JSON.parse(cloudPrefsRaw) }
            : DEFAULT_PREFERENCES;
          setPrefs(cloudPrefs);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(cloudPrefs));
          if (cloudUpdatedAt) localStorage.setItem(SETTINGS_UPDATED_AT_KEY, cloudUpdatedAt);
        } else if (localMs > cloudMs) {
          // 本地更新，上传云端
          const localPrefs = loadLocal();
          fetch(`/api/portfolio${idParam}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences: localPrefs }),
          })
            .then(() => invalidatePortfolioListCache())
            .catch(() => {});
        }
      } catch {
        // 未登录或网络错误，静默失败
      }
    };

    const handle = scheduleIdleTask(sync, 800);

    return () => {
      cancelIdleTask(handle);
    };
  }, [cloudSync, initialPortfolios]);

  // 监听其他 tab 的变更
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_KEY) {
        setPrefs(loadLocal());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updatePreference = useCallback(<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    const current = loadLocal();
    const updated = { ...current, [key]: value };
    const now = new Date().toISOString();

    // 1. 写入 localStorage
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    localStorage.setItem(SETTINGS_UPDATED_AT_KEY, now);

    // 2. 更新 React state
    setPrefs(updated);

    // 3. 上传云端（fire and forget）
    if (!cloudSync) {
      return;
    }

    const pid = new URLSearchParams(window.location.search).get('pid') ?? '';
    const idParam = pid ? `?id=${pid}` : '';
    fetch(`/api/portfolio${idParam}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: updated }),
    })
      .then(() => invalidatePortfolioListCache())
      .catch(() => {});
  }, [cloudSync]);

  // 根据 colorScheme 派生出具体颜色值，方便组件直接使用
  const colors = {
    gain: prefs.colorScheme === 'Emerald'
      ? { hex: '#10b981', tw: 'emerald', tailwind: { text: 'text-emerald-600', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', textLight: 'text-emerald-600' } }
      : { hex: '#f43f5e', tw: 'rose', tailwind: { text: 'text-rose-500', bg: 'bg-rose-500', bgLight: 'bg-rose-50', textLight: 'text-rose-500' } },
    loss: prefs.colorScheme === 'Emerald'
      ? { hex: '#f43f5e', tw: 'rose', tailwind: { text: 'text-rose-500', bg: 'bg-rose-500', bgLight: 'bg-rose-50', textLight: 'text-rose-500' } }
      : { hex: '#10b981', tw: 'emerald', tailwind: { text: 'text-emerald-600', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', textLight: 'text-emerald-600' } },
  };

  return { prefs, updatePreference, colors };
}
