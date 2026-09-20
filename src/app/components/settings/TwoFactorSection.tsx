'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase';
import { enrollTotpFactor, getVerifiedTotpFactor, unenrollTotpFactor } from '@/lib/mfa';

interface TwoFactorSectionProps {
  user: User | null;
}

type Drawer = 'closed' | 'enroll' | 'disable';

export default function TwoFactorSection({ user }: TwoFactorSectionProps) {
  const t = useTranslations('settings.mfa');
  const tAccount = useTranslations('settings.account');
  const tActions = useTranslations('settings.actions');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawer, setDrawer] = useState<Drawer>('closed');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [enrollFactorId, setEnrollFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrolled = Boolean(factorId);

  const refreshFactor = useCallback(async () => {
    if (!user) {
      setFactorId(null);
      setIsLoading(false);
      return;
    }
    try {
      const factor = await getVerifiedTotpFactor(createClient());
      setFactorId(factor?.id ?? null);
    } catch {
      setFactorId(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setIsLoading(true);
    void refreshFactor();
  }, [refreshFactor]);

  const resetDrawer = () => {
    setDrawer('closed');
    setQr('');
    setSecret('');
    setEnrollFactorId('');
    setCode('');
    setError(null);
    setBusy(false);
  };

  const handleOpenEnroll = async () => {
    setDrawer('enroll');
    setError(null);
    setCode('');
    setBusy(true);

    try {
      const { data, error: enrollError } = await enrollTotpFactor(createClient());
      if (enrollError) throw enrollError;
      if (!data || data.type !== 'totp') throw new Error(t('enrollFailed'));

      setEnrollFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('enrollFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelEnroll = async () => {
    if (enrollFactorId) {
      try {
        await createClient().auth.mfa.unenroll({ factorId: enrollFactorId });
      } catch {
        // Unverified leftover factors are cleaned up on the next enroll attempt.
      }
    }
    resetDrawer();
  };

  const handleVerifyEnroll = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!enrollFactorId || trimmed.length < 6) return;

    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollFactorId,
        code: trimmed,
      });
      if (verifyError) throw verifyError;
      resetDrawer();
      await refreshFactor();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('verifyFailed'));
      setBusy(false);
    }
  };

  const handleDisable = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!factorId || trimmed.length < 6) return;

    setBusy(true);
    setError(null);

    try {
      await unenrollTotpFactor(createClient(), factorId, trimmed);
      resetDrawer();
      await refreshFactor();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('disableFailed'));
      setBusy(false);
    }
  };

  const handleToggle = () => {
    if (drawer !== 'closed') {
      if (drawer === 'enroll') {
        void handleCancelEnroll();
        return;
      }
      resetDrawer();
      return;
    }
    if (enrolled) {
      setDrawer('disable');
      setError(null);
      setCode('');
      return;
    }
    void handleOpenEnroll();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-between px-4 py-4 md:px-5">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
            <ShieldCheck className="h-4 w-4 text-secondary" />
          </div>
          <div>
            <div className="text-[14px] font-bold leading-tight text-primary">{tAccount('twoFactorAuth')}</div>
            <div className="mt-0.5 text-[13px] font-medium text-secondary">{tAccount('disabled')}</div>
          </div>
        </div>
        <Loader2 className="h-4 w-4 animate-spin text-secondary" />
      </div>
    );
  }

  const buttonLabel = drawer !== 'closed'
    ? tActions('cancel')
    : enrolled
      ? t('disable')
      : tActions('enable');

  return (
    <div className="select-none border-b border-border">
      <div className="flex items-center justify-between px-4 py-4 md:px-5">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-all duration-300 ${drawer !== 'closed' ? 'scale-110 ring-4 ring-black/5' : ''}`}>
            <ShieldCheck className={`h-4 w-4 transition-colors duration-300 ${drawer !== 'closed' || enrolled ? 'text-primary' : 'text-secondary'}`} />
          </div>
          <div>
            <div className="text-[14px] font-bold leading-tight text-primary">{tAccount('twoFactorAuth')}</div>
            <div className="mt-0.5 text-[13px] font-medium text-secondary">
              {enrolled ? t('enabled') : tAccount('disabled')}
            </div>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold shadow-sm transition-all active:scale-95 md:text-[13px] ${
            drawer !== 'closed'
              ? 'border-border bg-element-hover text-secondary'
              : 'border-border bg-card text-primary hover:bg-element-hover'
          }`}
        >
          {buttonLabel}
        </button>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${drawer !== 'closed' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-border/60 bg-card px-4 py-4 md:px-5">
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 select-text">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-500" />
                <p className="text-[13px] font-medium leading-tight text-rose-600/80 dark:text-rose-400/80">{error}</p>
              </div>
            )}

            {drawer === 'enroll' && (
              <form onSubmit={handleVerifyEnroll} className="space-y-4">
                {busy && !qr ? (
                  <div className="flex items-center gap-2 text-[13px] font-medium text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('preparing')}
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-secondary">{t('scanQr')}</p>
                    {qr && (
                      <div className="flex justify-center">
                        <div className="rounded-2xl border border-border bg-white p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qr} alt={t('qrAlt')} className="h-40 w-40" />
                        </div>
                      </div>
                    )}
                    {secret && (
                      <div>
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-secondary">
                          {t('secretLabel')}
                        </div>
                        <div className="select-text break-all rounded-xl border border-border bg-element/50 px-4 py-2.5 font-mono text-[13px] font-medium text-primary">
                          {secret}
                        </div>
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
                        className="w-full rounded-xl border border-border bg-element/50 px-4 py-2.5 text-[14px] font-medium text-primary outline-none transition-all placeholder:text-secondary focus:border-primary focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !enrollFactorId || code.trim().length < 6}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {busy ? t('verifying') : t('verify')}
                    </button>
                  </>
                )}
              </form>
            )}

            {drawer === 'disable' && (
              <form onSubmit={handleDisable} className="space-y-4">
                <p className="text-[13px] font-medium text-secondary">{t('disableDescription')}</p>
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
                    className="w-full rounded-xl border border-border bg-element/50 px-4 py-2.5 text-[14px] font-medium text-primary outline-none transition-all placeholder:text-secondary focus:border-primary focus:ring-1 focus:ring-black"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || code.trim().length < 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 py-2.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? t('verifying') : t('disable')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
