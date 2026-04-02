import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { getCompanyProfile } from '@/lib/finnhub';
import { getLogo as getTwelveDataLogo } from '@/lib/twelvedata';

interface RouteContext {
  params: Promise<{ ticker: string }>;
}

async function resolveLogoUrl(ticker: string) {
  let assetId: string | null = null;
  let cachedLogo: string | null = null;

  try {
    const asset = await prisma.asset.findUnique({
      where: { ticker },
      select: { id: true, logo: true },
    });
    assetId = asset?.id ?? null;
    cachedLogo = asset?.logo ?? null;
  } catch (error) {
    console.warn(`Failed to read cached logo for ${ticker}:`, error);
  }

  if (cachedLogo) {
    return cachedLogo;
  }

  const profile = await getCompanyProfile(ticker);
  let logoUrl = profile?.logo || null;

  if (!logoUrl) {
    logoUrl = await getTwelveDataLogo(ticker);
  }

  if (assetId && logoUrl) {
    try {
      await prisma.asset.update({
        where: { id: assetId },
        data: { logo: logoUrl },
      });
    } catch (error) {
      console.warn(`Failed to persist resolved logo for ${ticker}:`, error);
    }
  }

  return logoUrl;
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker).toUpperCase();
  const logoUrl = await resolveLogoUrl(decodedTicker);

  if (!logoUrl) {
    return new NextResponse('Logo not found', {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
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
