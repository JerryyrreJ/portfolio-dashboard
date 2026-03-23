'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'primary';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  variant = 'danger'
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const isDanger = variant === 'danger';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={isLoading ? undefined : onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-[400px] bg-card rounded-[32px] shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="flex flex-col items-center text-center">
            {/* Icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-6 ${
              isDanger ? 'bg-rose-50 text-rose-500' : 'bg-primary/5 text-primary'
            }`}>
              <AlertCircle className="w-7 h-7" />
            </div>
            
            {/* Text Content */}
            <h3 className="text-[20px] font-bold text-primary tracking-tight mb-2">{title}</h3>
            <p className="text-[14px] text-secondary font-medium leading-relaxed">
              {description}
            </p>
          </div>
          
          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`w-full py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm ${
                isDanger 
                  ? 'bg-rose-500 text-white hover:bg-rose-600' 
                  : 'bg-primary text-on-primary hover:bg-primary-hover'
              } disabled:opacity-50`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmText}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-secondary hover:bg-element-hover transition-all active:scale-[0.98]"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
