/**
 * Alpha Vantage API client
 * Official docs: https://www.alphavantage.co/documentation/
 */

const API_KEY = process.env.ALPHAVANTAGE_API_KEY || '';
const BASE_URL = 'https://www.alphavantage.co/query';
const DIVIDEND_REQUEST_INTERVAL_MS = 1100;
const RATE_LIMIT_TTL_MS = 5 * 60 * 1000;

type AlphaVantageDividendState = 'missing' | 'available' | 'rate_limited';

// 基线状态只表达 "是否配置了 API key"；rate-limit 通过 TTL 表达，
// 避免单次 429 永久把整个 serverless 实例的其他用户也堵死。
type AlphaVantageBaseState = 'missing' | 'available';
const baseState: AlphaVantageBaseState = API_KEY ? 'available' : 'missing';
let rateLimitedUntil = 0;
let nextDividendRequestAt = 0;

function markRateLimited() {
  rateLimitedUntil = Date.now() + RATE_LIMIT_TTL_MS;
}

function isRateLimited() {
  return Date.now() < rateLimitedUntil;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDividendRateLimitMessage(message?: string) {
  if (!message) {
    return false;
  }

  return message.includes('1 request per second')
    || message.includes('25 requests per day')
    || message.includes('premium plans')
    || message.includes('Please consider spreading out your free API requests');
}

export interface AlphaVantageDividendData {
  symbol: string;
  ex_date: string;
  payment_date?: string;
  amount: number;
  currency?: string;
}

interface AlphaVantageDividendResponse {
  symbol?: string;
  data?: Array<{
    ex_dividend_date?: string;
    payment_date?: string;
    amount?: string;
  }>;
  Information?: string;
  Note?: string;
  ErrorMessage?: string;
}

async function fetchAlphaVantage(params: Record<string, string>) {
  if (!API_KEY) {
    return null;
  }

  if (params.function === 'DIVIDENDS') {
    if (isRateLimited()) {
      return null;
    }

    const now = Date.now();
    const waitMs = nextDividendRequestAt - now;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    nextDividendRequestAt = Date.now() + DIVIDEND_REQUEST_INTERVAL_MS;
  }

  const url = new URL(BASE_URL);
  url.searchParams.append('apikey', API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 60 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (params.function === 'DIVIDENDS' && response.status === 429) {
        markRateLimited();
      }
      console.warn(`Alpha Vantage API error: ${response.status} ${response.statusText} for ${params.function}`);
      return null;
    }

    const data = await response.json() as AlphaVantageDividendResponse;
    if (data.Information || data.Note || data.ErrorMessage) {
      if (params.function === 'DIVIDENDS' && isDividendRateLimitMessage(data.Information || data.Note || data.ErrorMessage)) {
        markRateLimited();
      }
      console.warn(
        `Alpha Vantage API error: ${data.Information || data.Note || data.ErrorMessage} for ${params.function}`
      );
      return null;
    }

    if (params.function === 'DIVIDENDS') {
      rateLimitedUntil = 0;
    }

    return data;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Alpha Vantage fetch exception for ${params.function}:`, message);
    return null;
  }
}

export function getDividendProviderState(): AlphaVantageDividendState {
  if (baseState === 'missing') return 'missing';
  if (isRateLimited()) return 'rate_limited';
  return 'available';
}

export async function getDividends(
  symbol: string,
  startDate?: string,
  endDate?: string
): Promise<{ ok: boolean; data: AlphaVantageDividendData[] }> {
  const data = await fetchAlphaVantage({
    function: 'DIVIDENDS',
    symbol: symbol.toUpperCase(),
  });

  // fetchAlphaVantage 返回 null 代表调用失败 / 限流 / API key 缺失；
  // 返回对象代表调用成功（此时 data.data 为空仅意味着这只票在范围内无分红）
  if (!data) {
    return { ok: false, data: [] };
  }

  if (!data.data?.length) {
    return { ok: true, data: [] };
  }

  const filtered = data.data
    .filter((dividend) => {
      if (!dividend.ex_dividend_date || !dividend.amount) {
        return false;
      }

      if (startDate && dividend.ex_dividend_date < startDate) {
        return false;
      }

      if (endDate && dividend.ex_dividend_date > endDate) {
        return false;
      }

      return true;
    })
    .map((dividend) => ({
      symbol: data.symbol || symbol.toUpperCase(),
      ex_date: dividend.ex_dividend_date as string,
      payment_date:
        dividend.payment_date && dividend.payment_date !== 'None'
          ? dividend.payment_date
          : undefined,
      amount: parseFloat(dividend.amount as string),
    }));

  return { ok: true, data: filtered };
}
