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
import Image from 'next/image';

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
  const [copied, setCopied] = useState(false);

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

      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true,
        pixelRatio: 2.5, // High resolution but safer than 3
        backgroundColor: '#FFFFFF',
      });
      
      const link = document.createElement('a');
      link.download = `folio-share-${ticker}-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      console.error('Failed to generate image:', err);
      // Fallback: try without cacheBust if it fails
      try {
         const dataUrl = await toPng(cardRef.current!, { pixelRatio: 2 });
         const link = document.createElement('a');
         link.download = `folio-share-${ticker}.png`;
         link.href = dataUrl;
         link.click();
      } catch (retryErr) {
         alert('Failed to generate image. Please try again or use a different browser.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [cardRef, ticker]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop with extreme blur as requested */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-2xl transition-opacity duration-300"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-[440px] flex flex-col items-center animate-in fade-in zoom-in duration-300">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors sm:-right-12 sm:top-0"
        >
          <X className="w-6 h-6" />
        </button>

        {/* The Card Component Wrapper - Handles scaling to fit mobile screens */}
        <div className="w-full flex justify-center py-2 sm:py-4 overflow-visible">
          <div className="scale-[0.8] xs:scale-[0.9] sm:scale-100 origin-top transition-transform duration-300">
            <div className="bg-white rounded-[32px] overflow-hidden shadow-2xl border border-white/20 w-[380px] sm:w-[400px]">
              <div 
                ref={cardRef} 
                className="bg-white p-8 sm:p-10 flex flex-col items-center text-center relative overflow-hidden"
                style={{ width: '100%', height: '520px' }}
              >
                {/* Background Accent */}
                <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${isProfit ? 'from-emerald-400 to-emerald-600' : 'from-rose-400 to-rose-600'}`} />
                
                {/* Header: Brand & Market */}
                <div className="w-full flex justify-between items-center mb-8">
                  <div className="flex items-center gap-1.5 text-black font-bold text-[14px] sm:text-[15px] tracking-tight">
                    <div className="bg-black text-white p-0.5 rounded">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <span>Folio</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                    Holding Snapshot
                  </span>
                </div>

                {/* Logo Section */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden mb-6 relative z-10">
                  {logo ? (
                    /* Use the proxy API to avoid CORS issues when generating screenshots */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={`/api/proxy-image?url=${encodeURIComponent(logo)}`} 
                      alt={ticker} 
                      className="w-full h-full object-cover scale-110"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-gray-800">{ticker.charAt(0)}</span>
                  )}
                </div>

                {/* Asset Title */}
                <h2 className="text-[11px] sm:text-[13px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1 truncate w-full px-4">{name}</h2>
                <h1 className="text-[32px] sm:text-[36px] font-black text-black tracking-tighter leading-none mb-6">{ticker}</h1>

                {/* Hero Number: Return Percentage */}
                <div className="flex flex-col items-center mb-8">
                  <div className={`text-[54px] sm:text-[64px] font-black tracking-tighter leading-none tabular-nums flex items-start gap-1 ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isProfit ? '+' : ''}{totalReturnPercent.toFixed(2)}
                    <span className="text-[24px] sm:text-[28px] mt-2 font-bold">%</span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] sm:text-[13px] font-bold mt-2 ${isProfit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                    {isProfit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {isProfit ? 'Total Gain' : 'Total Loss'}
                  </div>
                </div>

                {/* Key Stats: Grid */}
                <div className="grid grid-cols-3 w-full gap-2 pt-6 border-t border-gray-50">
                  <div className="text-center overflow-hidden">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">Avg. Cost</p>
                    <p className="text-[14px] sm:text-[15px] font-bold text-black tabular-nums truncate">{currencySymbol}{avgBuyPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-center overflow-hidden">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">Price</p>
                    <p className="text-[14px] sm:text-[15px] font-bold text-black tabular-nums truncate">{currencySymbol}{currentPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-center overflow-hidden">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{isProfit ? 'Profit' : 'Loss'}</p>
                    <p className={`text-[14px] sm:text-[15px] font-bold tabular-nums truncate ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                        <stop offset="0%" stopColor={isProfit ? '#10b981' : '#f43f5e'} stopOpacity="1" />
                        <stop offset="100%" stopColor={isProfit ? '#10b981' : '#f43f5e'} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path 
                      d={sparklinePath} 
                      fill="url(#sparklineGradient)"
                      stroke={isProfit ? '#10b981' : '#f43f5e'}
                      strokeWidth="0.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions (Only Save Image for now) */}
        <div className="w-full mt-0 sm:mt-6 px-4">
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-full py-4 bg-white text-black text-[16px] font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-xl flex items-center justify-center gap-3 group border border-gray-100 active:scale-[0.98]"
          >
            {isGenerating ? (
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            ) : (
              <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
            )}
            <span>{isGenerating ? 'Generating Image...' : 'Save Image'}</span>
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
