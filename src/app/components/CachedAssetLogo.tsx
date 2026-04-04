'use client';

import React, { memo, useMemo, useState } from 'react';

type CachedAssetLogoProps = {
  ticker: string;
  logoUrl?: string | null;
  size: number;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  loading?: 'eager' | 'lazy';
};

function buildProxyImageUrl(ticker: string) {
  return `/api/assets/${encodeURIComponent(ticker)}/logo`;
}

const CachedAssetLogo = memo(function CachedAssetLogo({
  ticker,
  logoUrl,
  size,
  alt,
  className,
  fallbackClassName,
  loading = 'eager',
}: CachedAssetLogoProps) {
  const [failedTicker, setFailedTicker] = useState<string | null>(null);
  const hasError = failedTicker === ticker;

  const proxiedSrc = useMemo(
    () => (ticker && logoUrl && !hasError ? buildProxyImageUrl(ticker) : null),
    [hasError, logoUrl, ticker]
  );

  if (!proxiedSrc) {
    return (
      <span
        className={fallbackClassName ?? 'font-bold'}
        style={{ fontSize: `${Math.max(11, Math.round(size * 0.3))}px` }}
      >
        {ticker.charAt(0)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxiedSrc}
      alt={alt ?? ticker}
      width={size}
      height={size}
      className={className ?? 'w-full h-full object-cover'}
      loading={loading}
      decoding="async"
      draggable={false}
      onError={() => setFailedTicker(ticker)}
    />
  );
});

export default CachedAssetLogo;
