'use client';

import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, AlertCircle, Shield, Fingerprint, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import Notification from '../Notification';
import { get } from '@github/webauthn-json';

interface AuthPanelProps {
  onLogin: () => void;
}

export default function AuthPanel({ onLogin }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{show: boolean, type: 'success'|'error', title: string, message: string}>({ show: false, type: 'success', title: '', message: '' });

  const supabase = createClient();

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 6) strength += 1;
    if (pass.length >= 10) strength += 1;
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
    return strength;
  };

  const strength = getPasswordStrength(password);
  const strengthColors = ['bg-element-hover', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-600'];

  // Load remembered email on mount
  React.useEffect(() => {
    const savedEmail = localStorage.getItem('folio_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'signup' && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        if (rememberMe) {
          localStorage.setItem('folio_remember_email', email);
        } else {
          localStorage.removeItem('folio_remember_email');
        }
        
        onLogin();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/confirm`,
          },
        });
        if (error) throw error;
        setNotification({
          show: true,
          type: 'success',
          title: 'Check your email',
          message: 'We sent you a confirmation link. Please verify your account to continue.'
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError(null);
    try {
      const initRes = await fetch('/api/passkeys/login/initialize', { method: 'POST' });
      if (!initRes.ok) throw new Error('Failed to initialize passkey login');
      const options = await initRes.json();

      const credential = await get(options as any);

      const finalRes = await fetch('/api/passkeys/login/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (!finalRes.ok) throw new Error('Passkey authentication failed');

      onLogin();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Passkey sign-in was cancelled. Try again when you\'re ready.');
      } else {
        setError(err.message || 'Passkey login failed');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/settings/update-password`,
      });
      
      if (error) throw error;
      
      setNotification({
        show: true,
        type: 'success',
        title: 'Reset Link Sent',
        message: 'Check your email for the password reset link.'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Notification 
        show={notification.show} 
        type={notification.type} 
        title={notification.title} 
        message={notification.message} 
        onClose={() => setNotification({ ...notification, show: false })} 
        autoClose={6000}
      />
      <div className="text-center md:text-left">
        <h3 className="text-[20px] font-bold text-primary tracking-tight leading-tight">
          {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
        </h3>
        <p className="text-[13px] text-secondary font-medium mt-1">
          {mode === 'login' 
            ? 'Sign in to sync your folio across devices.' 
            : 'Start managing your investments with cloud backup.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-start space-x-3 animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            <p className="text-[12px] font-medium text-rose-600">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="folio-email"
              name="folio-email"
              type="email"
              autoComplete="username"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-element border border-border rounded-2xl py-3.5 pl-11 pr-4 text-[14px] font-medium focus:bg-card focus:ring-1 focus:ring-black/5 transition-all outline-none"
            />
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="folio-password"
              name="folio-password"
              type="password"
              autoComplete={mode === 'login' ? "current-password" : "new-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-element border border-border rounded-2xl py-3.5 pl-11 pr-4 text-[14px] font-medium focus:bg-card focus:ring-1 focus:ring-black/5 transition-all outline-none"
            />
          </div>

          {mode === 'signup' && password && (
            <div className="px-1 mt-1 animate-in fade-in duration-500">
              <div className="flex space-x-1 h-1 w-full">
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step} 
                    className={`h-full flex-1 rounded-full transition-all duration-500 ${
                      step <= strength ? strengthColors[strength] : 'bg-element-hover'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[10px] font-bold text-secondary mt-1.5 uppercase tracking-wider">
                {strength === 1 && 'Weak'}
                {strength === 2 && 'Fair'}
                {strength === 3 && 'Good'}
                {strength >= 4 && 'Strong'}
              </p>
            </div>
          )}

          {mode === 'signup' && (
            <div className="relative group animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors">
                <Shield className="w-4 h-4" />
              </div>
              <input
                id="folio-confirm-password"
                name="folio-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-element border border-border rounded-2xl py-3.5 pl-11 pr-4 text-[14px] font-medium focus:bg-card focus:ring-1 focus:ring-black/5 transition-all outline-none"
              />
            </div>
          )}
        </div>

        {mode === 'login' && (
          <div className="flex items-center justify-between px-1 py-1">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-4 h-4 border border-border rounded-md bg-element peer-checked:bg-primary peer-checked:border-primary transition-all duration-200"></div>
                <svg className="absolute w-2.5 h-2.5 text-on-primary opacity-0 peer-checked:opacity-100 left-[3px] pointer-events-none transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[12px] font-medium text-secondary group-hover:text-primary transition-colors">Remember me</span>
            </label>
            
            <button 
              type="button"
              onClick={handleForgotPassword}
              className="text-[12px] font-medium text-secondary hover:text-primary transition-colors"
            >
              Forgot password?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-on-primary rounded-2xl py-3.5 text-[14px] font-bold hover:bg-gray-900 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>{mode === 'login' ? 'Sign In' : 'Sign Up'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {mode === 'login' && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-element-hover" />
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-element-hover" />
          </div>
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
            className="w-full border border-border bg-element hover:bg-element-hover text-primary rounded-2xl py-3.5 text-[14px] font-bold transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {passkeyLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Fingerprint className="w-4 h-4" />
            )}
            <span>{passkeyLoading ? 'Authenticating...' : 'Sign in with Passkey'}</span>
          </button>
        </>
      )}

      <div className="pt-4 text-center">
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
          }}
          className="text-[13px] font-medium text-secondary hover:text-primary transition-colors"
        >
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <span className="font-bold underline decoration-gray-200 underline-offset-4 hover:decoration-black transition-all">
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </span>
        </button>
      </div>
    </div>
  );
}
