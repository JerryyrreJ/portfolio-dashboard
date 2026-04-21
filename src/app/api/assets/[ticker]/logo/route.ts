import { NextRequest, NextResponse } from 'next/server';

import prisma, { withRetry } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ ticker: string }>;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
]);

function isSafeHttpsUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(host)) return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

async function resolveLogoUrl(ticker: string) {
  try {
    const asset = await withRetry(() => prisma.asset.findUnique({
      where: { ticker },
      select: { logo: true },
    }));
    return asset?.logo ?? null;
  } catch (error) {
    console.warn(`Failed to read cached logo for ${ticker}:`, error);
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker).toUpperCase();
  const storedLogoUrl = await resolveLogoUrl(decodedTicker);

  if (!isSafeHttpsUrl(storedLogoUrl)) {
    return new NextResponse('Logo not found', {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  }

  try {
    const response = await fetch(storedLogoUrl, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error(`Logo proxy error for ${decodedTicker}:`, error);
    return new NextResponse('Error fetching logo', {
      status: 502,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}
