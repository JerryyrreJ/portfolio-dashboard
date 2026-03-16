'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Preferences {
  colorScheme: 'Emerald' | 'Rose';
  chartType: 'Area Chart' | 'Line Chart' | 'Bar Chart';
  theme: 'Light' | 'Dark' | 'System';
  hideSmallBalances: boolean;
  realTimeSync: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  colorScheme: 'Emerald',
  chartType: 'Area Chart',
  theme: 'System',
  hideSmallBalances: false,
  realTimeSync: true,
};

const LOCAL_KEY = 'user_preferences';
const SETTINGS_UPDATED_AT_KEY = 'settings_updated_at';

function loadLocal(): Preferences {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  // 初始化：立即从 localStorage 读取
  useEffect(() => {
    setPrefs(loadLocal());

    // 云端同步（仅登录用户）
    const sync = async () => {
      try {
        const res = await fetch('/api/portfolio');
        if (!res.ok) return;
        const data = await res.json();

        const cloudPrefsRaw: string | null = data.portfolio?.preferences ?? null;
        const cloudUpdatedAt: string | null = data.portfolio?.settingsUpdatedAt ?? null;
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
          fetch('/api/portfolio', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences: localPrefs }),
          }).catch(() => {});
        }
      } catch {
        // 未登录或网络错误，静默失败
      }
    };

    sync();
  }, []);

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
    fetch('/api/portfolio', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: updated }),
    }).catch(() => {});
  }, []);

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
