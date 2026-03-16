'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, Loader2, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { create } from '@github/webauthn-json';
import { User } from '@supabase/supabase-js';

interface PasskeySectionProps {
  user: User | null;
}

interface Credential {
  id: string;
  name?: string;
  created_at: string;
  last_used_at?: string;
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  const os = ua.includes('iPhone') ? 'iPhone'
    : ua.includes('iPad') ? 'iPad'
    : ua.includes('Mac') ? 'macOS'
    : ua.includes('Win') ? 'Windows'
    : ua.includes('Android') ? 'Android'
    : 'Device';
  const browser = ua.includes('Chrome') && !ua.includes('Edg') ? 'Chrome'
    : ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari'
    : ua.includes('Firefox') ? 'Firefox'
    : ua.includes('Edg') ? 'Edge'
    : 'Browser';
  return `${os} · ${browser}`;
}

const CACHE_KEY = 'passkey_credentials';

function loadCache(): Credential[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCache(data: Credential[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

export default function PasskeySection({ user }: PasskeySectionProps) {
  const cached = typeof window !== 'undefined' ? loadCache() : [];
  const [credentials, setCredentials] = useState<Credential[]>(cached);
  const [isLoadingList, setIsLoadingList] = useState(cached.length === 0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newPasskeyName, setNewPasskeyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchCredentials();
  }, [user]);

  // Auto-focus name input when add drawer opens
  useEffect(() => {
    if (isAddingNew) {
      setNewPasskeyName(getDeviceLabel());
      setTimeout(() => nameInputRef.current?.select(), 50);
    }
  }, [isAddingNew]);

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/passkeys/credentials');
      if (!res.ok) return;
      const cloud: Credential[] = await res.json();
      setCredentials(cloud);
      saveCache(cloud);
    } catch {
      // silently fail — cached list stays
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleRegister = async () => {
    if (!newPasskeyName.trim()) return;
    setIsRegistering(true);
    setError(null);

    try {
      const initRes = await fetch('/api/passkeys/register/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: newPasskeyName.trim() }),
      });
      if (!initRes.ok) throw new Error('Failed to initialize passkey registration');

      const options = await initRes.json();
      const credential = await create(options as any);

      const finalRes = await fetch('/api/passkeys/register/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (!finalRes.ok) throw new Error('Failed to finalize passkey registration');

      setIsAddingNew(false);
      setNewPasskeyName('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await fetchCredentials();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Setup cancelled. Try again when you\'re ready.');
      } else {
        setError(err.message || 'Failed to register passkey');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRemove = async (credentialId: string) => {
    setError(null);
    // Optimistic update
    const prev = credentials;
    const next = credentials.filter(c => c.id !== credentialId);
    setCredentials(next);
    saveCache(next);
    try {
      const res = await fetch(`/api/passkeys/credentials/${credentialId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove passkey');
    } catch (err: any) {
      // Rollback on failure
      setCredentials(prev);
      saveCache(prev);
      setError(err.message || 'Failed to remove passkey');
    }
  };

  const hasPasskeys = credentials.length > 0;

  // While loading, render a placeholder row matching the original style
  if (isLoadingList) {
    return (
      <div className="px-4 md:px-5 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            <Fingerprint className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <div className="text-[14px] font-bold text-black leading-tight">Passkeys</div>
            <div className="text-[12px] text-gray-400 font-medium mt-0.5">FaceID / TouchID</div>
          </div>
        </div>
        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="select-none">
      {/* Main Row */}
      <div className="px-4 md:px-5 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className={`w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center transition-all duration-300 ${isEditOpen ? 'scale-110 border-gray-200 ring-4 ring-black/5' : ''}`}>
            <Fingerprint className={`w-4 h-4 transition-colors duration-300 ${isEditOpen ? 'text-black' : 'text-gray-400'}`} />
          </div>
          <div>
            <div className="text-[14px] font-bold text-black leading-tight">Passkeys</div>
            <div className="text-[12px] text-gray-400 font-medium mt-0.5">
              {hasPasskeys ? `${credentials.length} passkey${credentials.length > 1 ? 's' : ''} registered` : 'Disabled'}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (isAddingNew) {
              setIsAddingNew(false);
              setError(null);
              setNewPasskeyName('');
            } else if (!hasPasskeys) {
              setIsEditOpen(false);
              setIsAddingNew(true);
              setError(null);
            } else {
              setIsEditOpen(!isEditOpen);
              setIsAddingNew(false);
              setError(null);
            }
          }}
          className="text-[12px] md:text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 border bg-white border-gray-100 text-black hover:bg-gray-100 data-[active=true]:bg-gray-100 data-[active=true]:border-gray-200 data-[active=true]:text-gray-700"
          data-active={isEditOpen || isAddingNew}
        >
          {isAddingNew ? 'Cancel' : !hasPasskeys ? 'Enable' : isEditOpen ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Setup drawer — shown when no passkeys yet and user clicked Enable */}
      <div className={`grid transition-all duration-300 ease-in-out ${isAddingNew && !hasPasskeys ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="px-4 md:px-5 pb-4 pt-1 bg-white border-t border-gray-100/60 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 select-text">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-rose-600 font-medium leading-tight">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Passkey Name
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={newPasskeyName}
                onChange={(e) => setNewPasskeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                placeholder="e.g., MacBook Pro, iPhone 15"
                className="w-full px-4 py-2.5 bg-gray-50/50 rounded-xl text-[14px] text-black font-medium border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-gray-400 select-text"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRegister}
                disabled={isRegistering || !newPasskeyName.trim()}
                className="w-full bg-black text-white text-[13px] font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm select-none touch-manipulation"
              >
                {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
                {isRegistering ? 'Setting up...' : 'Register Passkey'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit drawer — shown when passkeys exist and user clicked Edit */}
      <div className={`grid transition-all duration-300 ease-in-out ${isEditOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-gray-100/60">

            {/* Feedback messages inside drawer */}
            {success && (
              <div className="mx-4 md:mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-emerald-600 font-medium leading-tight">Passkey registered successfully!</p>
              </div>
            )}
            {error && (
              <div className="mx-4 md:mx-5 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-rose-600 font-medium leading-tight">{error}</p>
              </div>
            )}

            {/* Existing passkeys list */}
            <div className="divide-y divide-gray-100">
              {credentials.map((cred) => (
                <div key={cred.id} className="px-4 md:px-5 py-3.5 flex items-center justify-between group">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-black leading-tight">
                      {cred.name || 'Unnamed Passkey'}
                    </div>
                    <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                      Added {new Date(cred.created_at).toLocaleDateString()}
                      {cred.last_used_at && ` · Last used ${new Date(cred.last_used_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(cred.id)}
                    className="shrink-0 ml-3 text-[12px] font-bold text-rose-500 border border-rose-100/50 bg-rose-50/30 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Add another passkey */}
            <div className="px-4 md:px-5 py-4 border-t border-gray-100">
              {!isAddingNew ? (
                <button
                  onClick={() => { setIsAddingNew(true); setError(null); }}
                  className="w-full text-[13px] font-bold text-black border border-gray-200 bg-gray-50 hover:bg-gray-100 py-2.5 rounded-xl transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Passkey
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Passkey Name
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={newPasskeyName}
                      onChange={(e) => setNewPasskeyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                      placeholder="e.g., MacBook Pro, iPhone 15"
                      className="w-full px-4 py-2.5 bg-gray-50/50 rounded-xl text-[14px] text-black font-medium border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-gray-400 select-text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsAddingNew(false); setError(null); setNewPasskeyName(''); }}
                      className="flex-1 text-[13px] font-bold py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRegister}
                      disabled={isRegistering || !newPasskeyName.trim()}
                      className="flex-1 bg-black text-white text-[13px] font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm select-none touch-manipulation"
                    >
                      {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isRegistering ? 'Setting up...' : 'Register Passkey'}
                    </button>                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
