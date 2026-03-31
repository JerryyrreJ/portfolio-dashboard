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

function buildProxyImageUrl(logoUrl: string) {
  return `/api/proxy-image?url=${encodeURIComponent(logoUrl)}`;
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
  const [hasError, setHasError] = useState(false);
  const proxiedSrc = useMemo(
    () => (logoUrl && !hasError ? buildProxyImageUrl(logoUrl) : null),
    [hasError, logoUrl]
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
      onError={() => setHasError(true)}
    />
  );
});

export default CachedAssetLogo;
