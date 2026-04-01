'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface NotificationProps {
  show: boolean;
  type: 'success' | 'error' | 'loading';
  title: string;
  message: string;
  onClose: () => void;
  autoClose?: number;
}

export default function Notification({ show, type, title, message, onClose, autoClose = 5000 }: NotificationProps) {
  const [isRendered, setIsRendered] = useState(show);

  useEffect(() => {
    let renderTimer: ReturnType<typeof setTimeout> | undefined;
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;

    if (show) {
      renderTimer = setTimeout(() => setIsRendered(true), 0);
      if (type !== 'loading' && autoClose > 0) {
        autoCloseTimer = setTimeout(onClose, autoClose);
      }
    } else {
      renderTimer = setTimeout(() => setIsRendered(false), 3000);
    }

    return () => {
      if (renderTimer) clearTimeout(renderTimer);
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
    };
  }, [show, type, autoClose, onClose]);

  if (!isRendered) return null;

  return (
    <div className={`fixed top-20 right-6 z-[100] transition-all duration-500 transform ${show ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0 pointer-events-none'}`}>
      <div className="bg-white/80 backdrop-blur-2xl border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-[24px] p-4 pr-12 min-w-[320px] max-w-[400px] flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          type === 'success' ? 'bg-emerald-50 text-emerald-500' : 
          type === 'error' ? 'bg-rose-50 text-rose-500' : 
          'bg-gray-50 text-black'
        }`}>
          {type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {type === 'error' && <AlertCircle className="w-5 h-5" />}
          {type === 'loading' && <Loader2 className="w-5 h-5 animate-spin" />}
        </div>
        
        <div className="flex-1 pt-0.5">
          <h4 className="text-[14px] font-bold text-black mb-0.5">{title}</h4>
          <p className="text-[13px] text-gray-500 font-medium leading-relaxed">{message}</p>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-300 hover:text-black transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
