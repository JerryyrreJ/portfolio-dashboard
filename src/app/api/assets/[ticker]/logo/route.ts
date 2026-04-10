import { NextRequest, NextResponse } from 'next/server';

import prisma, { withRetry } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ ticker: string }>;
}

function sanitizeLogoUrl(value: string | null) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function resolveLogoUrl(ticker: string) {
  let cachedLogo: string | null = null;

  try {
    const asset = await withRetry(() => prisma.asset.findUnique({
      where: { ticker },
      select: { logo: true },
    }));
    cachedLogo = asset?.logo ?? null;
  } catch (error) {
    console.warn(`Failed to read cached logo for ${ticker}:`, error);
  }

  return cachedLogo;
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker).toUpperCase();
  const cachedLogoUrl = await resolveLogoUrl(decodedTicker);
  const requestedLogoUrl = sanitizeLogoUrl(request.nextUrl.searchParams.get('v'));
  const logoUrl = requestedLogoUrl ?? cachedLogoUrl;

  if (requestedLogoUrl && requestedLogoUrl !== cachedLogoUrl) {
    void withRetry(() => prisma.asset.update({
      where: { ticker: decodedTicker },
      data: { logo: requestedLogoUrl },
    })).catch((error) => {
      console.warn(`Failed to persist requested logo for ${decodedTicker}:`, error);
    });
  }

  if (!logoUrl) {
    return new NextResponse('Logo not found', {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  }

  try {
    const response = await fetch(logoUrl, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType || 'image/png',
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
