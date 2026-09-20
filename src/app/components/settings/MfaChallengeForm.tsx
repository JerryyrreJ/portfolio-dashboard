'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase';
import { verifyTotpCode } from '@/lib/mfa';

interface MfaChallengeFormProps {
  onVerified: () => void;
  onCancel?: () => void;
}

export default function MfaChallengeForm({ onVerified, onCancel }: MfaChallengeFormProps) {
  const t = useTranslations('settings.mfa');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 6) return;

    setLoading(true);
    setError(null);

    try {
      await verifyTotpCode(createClient(), trimmed);
      onVerified();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message !== 'NO_TOTP_FACTOR'
        ? err.message
        : t('verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center md:text-left">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-element">
          <Shield className="h-4 w-4 text-secondary" />
        </div>
        <h3 className="text-[20px] font-bold leading-tight tracking-tight text-primary">
          {t('challengeTitle')}
        </h3>
        <p className="mt-1 text-[13px] font-medium text-secondary">
          {t('challengeDescription')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start space-x-3 rounded-xl border border-rose-100 bg-rose-50 p-3 animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <p className="text-[12px] font-medium text-rose-600">{error}</p>
          </div>
        )}

        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-secondary">
            {t('codeLabel')}
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\s/g, ''))}
            placeholder={t('codePlaceholder')}
            className="w-full rounded-2xl border border-border bg-element px-4 py-3.5 text-center text-[18px] font-bold tracking-[0.3em] text-primary outline-none transition-all placeholder:tracking-normal placeholder:text-secondary focus:bg-card focus:ring-1 focus:ring-black/5"
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.trim().length < 6}
          className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-primary py-3.5 text-[14px] font-bold text-on-primary shadow-sm transition-all hover:bg-gray-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>{loading ? t('verifying') : t('verify')}</span>
        </button>
      </form>

      {onCancel && (
        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] font-medium text-secondary transition-colors hover:text-primary"
          >
            {t('backToSignIn')}
          </button>
        </div>
      )}
    </div>
  );
}
