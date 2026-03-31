'use client';

import React, { useRef, useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import {
  X,
  Download,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { usePreferences } from '@/lib/usePreferences';
import CachedAssetLogo from './CachedAssetLogo';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockData: {
    ticker: string;
    name: string;
    currentPrice: number;
    avgBuyPrice: number;
    totalReturn: number;
    totalReturnPercent: number;
    logo?: string | null;
    currencySymbol: string;
    chartData?: Array<{ date: string; price: number }>;
  };
}

export default function ShareCardModal({ isOpen, onClose, stockData }: ShareCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { colors } = usePreferences();

  const {
    ticker,
    name,
    currentPrice,
    avgBuyPrice,
    totalReturn,
    totalReturnPercent,
    logo,
    currencySymbol,
    chartData = []
  } = stockData;

  const isProfit = totalReturnPercent >= 0;
  const profitColor = isProfit ? colors.gain : colors.loss;

  // Generate SVG path for the background sparkline
  const generateSparklinePath = useCallback(() => {
    if (!chartData || chartData.length < 2) return '';
    
    const prices = chartData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    
    // Width and height of the sparkline area (normalized 100x40)
    const w = 100;
    const h = 40;
    
    const points = chartData.map((d, i) => {
      const x = (i / (chartData.length - 1)) * w;
      // Invert y: higher price = lower y-coordinate
      // Ensure we have some padding and handle zero range
      const y = h - ((d.price - min) / (range || 1)) * (h * 0.8) - (h * 0.1);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    
    // Create the area path (closed at the bottom)
    return `M 0,${h} L ${points.join(' L ')} L ${w},${h} Z`;
  }, [chartData]);

  const sparklinePath = generateSparklinePath();

  const handleDownload = useCallback(async () => {
    if (cardRef.current === null) return;
    
    setIsGenerating(true);
    try {
      // Small delay to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      const isDark = document.documentElement.classList.contains('dark');
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: isDark ? '#1c1c1e' : '#FFFFFF',
      });
      
      const link = document.createElement('a');
      link.download = `folio-share-${ticker}-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: unknown) {
      console.error('Failed to generate image:', err);
      // Fallback: try without cacheBust if it fails
      try {
         const dataUrl = await toPng(cardRef.current!, { pixelRatio: 2 });
         const link = document.createElement('a');
         link.download = `folio-share-${ticker}.png`;
         link.href = dataUrl;
         link.click();
      } catch {
         alert('Failed to generate image. Please try again or use a different browser.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [cardRef, ticker]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop with extreme blur as requested */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-2xl transition-opacity duration-300"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-[480px] animate-in fade-in zoom-in duration-300">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* The Card Component (This is what gets screenshotted) */}
        <div className="bg-card rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-2xl border border-border">
          <div
            ref={cardRef}
            className="bg-card p-6 sm:p-10 flex flex-col items-center text-center relative overflow-hidden"
            style={{ width: '100%', aspectRatio: '4/5' }}
          >
            {/* Background Accent */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-${profitColor.tw}-400 to-${profitColor.tw}-600`} />

            {/* Header: Brand & Market */}
            <div className="w-full flex justify-between items-center mb-6 sm:mb-10">
              <div className="flex items-center gap-1 sm:gap-1.5 text-primary font-bold text-[13px] sm:text-[15px] tracking-tight">
                <div className="bg-primary text-on-primary p-0.5 rounded">
                  <TrendingUp className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                </div>
                <span>Folio</span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold text-secondary uppercase tracking-widest bg-element px-2 py-0.5 rounded-full border border-border">
                Holding Snapshot
              </span>
            </div>

            {/* Logo Section */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-card border border-border shadow-sm flex items-center justify-center overflow-hidden mb-4 sm:mb-6 relative z-10">
              <CachedAssetLogo
                ticker={ticker}
                logoUrl={logo}
                size={80}
                loading="eager"
                className="w-full h-full object-cover scale-110"
                fallbackClassName="font-bold text-2xl sm:text-3xl text-primary"
              />
            </div>

            {/* Asset Title */}
            <h2 className="text-[12px] sm:text-[14px] font-bold text-secondary uppercase tracking-[0.2em] mb-0.5 sm:mb-1">{name}</h2>
            <h1 className="text-[28px] sm:text-[36px] font-black text-primary tracking-tighter leading-none mb-4 sm:mb-8">{ticker}</h1>

            {/* Hero Number: Return Percentage */}
            <div className="flex flex-col items-center mb-6 sm:mb-10">
              <div className={`text-[48px] sm:text-[64px] font-black tracking-tighter leading-none tabular-nums flex items-start gap-0.5 sm:gap-1 ${profitColor.tailwind.text}`}>
                {isProfit ? '+' : ''}{totalReturnPercent.toFixed(2)}
                <span className="text-[20px] sm:text-[28px] mt-1.5 sm:mt-2 font-bold">%</span>
              </div>
              <div className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-[13px] font-bold mt-1.5 sm:mt-2 ${profitColor.tailwind.bgLight} ${profitColor.tailwind.textLight}`}>
                {isProfit ? <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 h-4" /> : <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 h-4" />}
                {isProfit ? 'Total Gain' : 'Total Loss'}
              </div>
            </div>

            {/* Key Stats: Grid */}
            <div className="grid grid-cols-3 w-full gap-2 sm:gap-4 pt-6 sm:pt-8 border-t border-border">
              <div className="text-center">
                <p className="text-[9px] sm:text-[10px] font-bold text-secondary uppercase tracking-wider mb-0.5 sm:mb-1">Avg. Cost</p>
                <p className="text-[13px] sm:text-[15px] font-bold text-primary tabular-nums">{currencySymbol}{avgBuyPrice.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] sm:text-[10px] font-bold text-secondary uppercase tracking-wider mb-0.5 sm:mb-1">Market Price</p>
                <p className="text-[13px] sm:text-[15px] font-bold text-primary tabular-nums">{currencySymbol}{currentPrice.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] sm:text-[10px] font-bold text-secondary uppercase tracking-wider mb-0.5 sm:mb-1">{isProfit ? 'Profit' : 'Loss'}</p>
                <p className={`text-[13px] sm:text-[15px] font-bold tabular-nums ${profitColor.tailwind.text}`}>
                  {isProfit ? '+' : '-'}{currencySymbol}{Math.abs(totalReturn).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Real Data Sparkline Background */}
            <div className="absolute inset-0 top-1/2 opacity-[0.08] pointer-events-none z-0">
              <svg 
                viewBox="0 0 100 40" 
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={profitColor.hex} stopOpacity="1" />
                    <stop offset="100%" stopColor={profitColor.hex} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path 
                  d={sparklinePath} 
                  fill="url(#sparklineGradient)"
                  stroke={profitColor.hex}
                  strokeWidth="0.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Modal Actions (Only Save Image for now) */}
        <div className="mt-8">
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-full py-4 bg-card text-primary text-[16px] font-bold rounded-2xl hover:bg-element transition-all shadow-xl flex items-center justify-center gap-3 group border border-border active:scale-[0.98]"
          >
            {isGenerating ? (
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            ) : (
              <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
            )}
            <span>{isGenerating ? 'Generating High-Res Image...' : 'Save Image'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function RefreshCw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
