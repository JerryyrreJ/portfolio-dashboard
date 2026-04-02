'use client';

export interface PortfolioClientRecord {
  id: string;
  name?: string;
  currency?: string;
  preferences?: string | null;
  settingsUpdatedAt?: string | null;
}

export interface PortfolioListResponse {
  portfolios?: PortfolioClientRecord[];
  error?: string;
}

const PORTFOLIO_CACHE_TTL_MS = 5000;

let cachedPortfolioResponse: PortfolioListResponse | null = null;
let cachedAt = 0;
let inFlightPortfolioRequest: Promise<PortfolioListResponse> | null = null;

export async function fetchPortfolioList(options?: { force?: boolean }): Promise<PortfolioListResponse> {
  const force = options?.force ?? false;
  const now = Date.now();

  if (!force && cachedPortfolioResponse && now - cachedAt < PORTFOLIO_CACHE_TTL_MS) {
    return cachedPortfolioResponse;
  }

  if (!force && inFlightPortfolioRequest) {
    return inFlightPortfolioRequest;
  }

  inFlightPortfolioRequest = fetch('/api/portfolio', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Failed to load portfolios');
      }

      const payload = await response.json() as PortfolioListResponse;
      cachedPortfolioResponse = payload;
      cachedAt = Date.now();
      return payload;
    })
    .finally(() => {
      inFlightPortfolioRequest = null;
    });

  return inFlightPortfolioRequest;
}

export function invalidatePortfolioListCache() {
  cachedPortfolioResponse = null;
  cachedAt = 0;
  inFlightPortfolioRequest = null;
}
