'use client';

import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface AuthPanelProps {
  onLogin: () => void;
}

export default function AuthPanel({ onLogin }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/confirm`,
          },
        });
        if (error) throw error;
        // If sign up is successful, Supabase might require email confirmation 
        // depending on your project settings.
        if (mode === 'signup') {
          alert('Check your email for the confirmation link!');
        }
      }
      onLogin();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center md:text-left">
        <h3 className="text-[20px] font-bold text-black tracking-tight leading-tight">
          {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
        </h3>
        <p className="text-[13px] text-gray-400 font-medium mt-1">
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
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-11 pr-4 text-[14px] font-medium focus:bg-white focus:ring-1 focus:ring-black/5 transition-all outline-none"
            />
          </div>
          
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-11 pr-4 text-[14px] font-medium focus:bg-white focus:ring-1 focus:ring-black/5 transition-all outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded-2xl py-3.5 text-[14px] font-bold hover:bg-gray-900 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
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

      <div className="pt-4 text-center">
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
          }}
          className="text-[13px] font-medium text-gray-500 hover:text-black transition-colors"
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

