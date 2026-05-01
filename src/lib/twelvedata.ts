/**
 * Twelve Data API 客户端
 * 文档: https://twelvedata.com/docs
 */

const API_KEY = process.env.TWELVEDATA_API_KEY || '';
const BASE_URL = 'https://api.twelvedata.com';
const RATE_LIMIT_TTL_MS = 5 * 60 * 1000;
const UNSUPPORTED_TTL_MS = 30 * 60 * 1000;

type TwelveDataDividendSupport = 'missing' | 'unknown' | 'supported' | 'unsupported';

// 基线状态仅反映 API key 是否配置；unsupported（403/"grow or pro" 提示）与
// rate-limit（429）都通过 TTL 表达，避免单次错误被模块级状态永久粘住。
let baseDividendSupport: 'missing' | 'unknown' | 'supported' = API_KEY ? 'unknown' : 'missing';
let unsupportedUntil = 0;
let rateLimitedUntil = 0;

// Finnhub resolution → Twelve Data interval
const RESOLUTION_MAP: Record<string, string> = {
  '1': '1min',
  '5': '5min',
  '15': '15min',
  '30': '30min',
  '60': '1h',
  'D': '1day',
  'W': '1week',
  'M': '1month',
};

interface TDValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TDTimeSeriesResponse {
  values?: TDValue[];
}

interface TDLogoResponse {
  url?: string;
}

interface TDQuoteResponse {
  currency?: string;
  close?: string;
  change?: string;
  percent_change?: string;
  high?: string;
  low?: string;
  open?: string;
  previous_close?: string;
  fifty_two_week?: {
    high?: string;
    low?: string;
  };
}

interface TDDividendEntry {
  ex_date: string;
  payment_date?: string;
  amount: string;
}

interface TDDividendsResponse {
  symbol?: string;
  currency?: string;
  dividends?: TDDividendEntry[];
}

// 与 Finnhub HistoricalCandle 格式兼容
export interface HistoricalCandle {
  c: number[]; // 收盘价
  h: number[]; // 最高价
  l: number[]; // 最低价
  o: number[]; // 开盘价
  t: number[]; // 时间戳（Unix 秒）
  s: string;   // 状态
}

// 速率限制追踪
export function isTwelveDataRateLimited() {
  return Date.now() < rateLimitedUntil;
}

export function resetTwelveDataRateLimit() {
  rateLimitedUntil = 0;
}

async function fetchTwelveData<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('apikey', API_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 60 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 429) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_TTL_MS;
    }

    if (!response.ok) {
      console.warn(`Twelve Data API error: ${response.status} ${response.statusText} for ${endpoint}`);
      return null;
    }

    const data = await response.json() as {
      status?: string;
      code?: number;
      message?: string;
    } & T;

    if (data.status === 'error' || data.code === 429) {
      if (data.code === 429 || data.message?.includes('rate limit')) {
        rateLimitedUntil = Date.now() + RATE_LIMIT_TTL_MS;
      }
      console.warn(`Twelve Data API error: ${data.message} for ${endpoint}`);
      return null;
    }

    return data;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : error;
    console.warn(`Twelve Data fetch exception for ${endpoint}:`, message);
    return null;
  }
}

/**
 * 获取公司 Logo URL
 * @param symbol 股票代码
 */
export async function getLogo(symbol: string): Promise<string | null> {
  const data = await fetchTwelveData<TDLogoResponse>('/logo', {
    symbol: symbol.toUpperCase(),
  });
  return data?.url || null;
}

/**
 * 获取 K 线数据，返回与 Finnhub HistoricalCandle 兼容的格式
 * @param symbol 股票代码
 * @param from 开始时间戳（Unix 秒）
 * @param to 结束时间戳（Unix 秒）
 * @param resolution Finnhub 风格的周期: 1, 5, 15, 30, 60, D, W, M
 */
export async function getCandles(
  symbol: string,
  from: number,
  to: number,
  resolution: string = 'D'
): Promise<HistoricalCandle | null> {
  const interval = RESOLUTION_MAP[resolution] || '1day';
  const startDate = new Date(from * 1000).toISOString().split('T')[0];
  const endDate = new Date(to * 1000).toISOString().split('T')[0];

  const data = await fetchTwelveData<TDTimeSeriesResponse>('/time_series', {
    symbol: symbol.toUpperCase(),
    interval,
    start_date: startDate,
    end_date: endDate,
    outputsize: '5000',
  });

  if (!data || !data.values || data.values.length === 0) {
    return null;
  }

  // Twelve Data 返回的是倒序（最新在前），反转为正序
  const values: TDValue[] = [...data.values].reverse();

  return {
    s: 'ok',
    c: values.map(v => parseFloat(v.close)),
    h: values.map(v => parseFloat(v.high)),
    l: values.map(v => parseFloat(v.low)),
    o: values.map(v => parseFloat(v.open)),
    t: values.map(v => Math.floor(new Date(v.datetime).getTime() / 1000)),
  };
}

/**
 * 获取股票实时报价
 * @param symbol 股票代码
 */
export async function getQuote(symbol: string): Promise<{
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
} | null> {
  const data = await fetchTwelveData<TDQuoteResponse>('/quote', {
    symbol: symbol.toUpperCase(),
  });
  if (!data?.currency || !data?.close) return null;
  return {
    currency: data.currency,
    price: parseFloat(data.close),
    change: parseFloat(data.change ?? '0'),
    changePercent: parseFloat(data.percent_change ?? '0'),
    high: parseFloat(data.fifty_two_week?.high ?? data.high ?? '0'),
    low: parseFloat(data.fifty_two_week?.low ?? data.low ?? '0'),
    open: parseFloat(data.open ?? '0'),
    prevClose: parseFloat(data.previous_close ?? '0'),
  };
}

/**
 * 获取指定日期附近的收盘价
 * @param symbol 股票代码
 * @param date 日期字符串或 Date 对象
 */
export async function getPriceOnDate(symbol: string, date: string | Date): Promise<number | null> {
  const targetDate = typeof date === 'string' ? new Date(date + 'T00:00:00Z') : new Date(date);
  const endDate = targetDate.toISOString().split('T')[0];
  const startDate = new Date(targetDate);
  startDate.setUTCDate(startDate.getUTCDate() - 7);

  const data = await fetchTwelveData<TDTimeSeriesResponse>('/time_series', {
    symbol: symbol.toUpperCase(),
    interval: '1day',
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate,
    outputsize: '10',
  });

  const latestValue = data?.values?.[0];
  if (latestValue) {
    return parseFloat(latestValue.close); // 最新在前
  }
  return null;
}

/**
 * 获取过去 12 个月的每日价格历史
 * @param symbol 股票代码
 */
export async function get12MonthHistory(symbol: string): Promise<{ date: string; price: number }[]> {
  const to = new Date();
  const from = new Date();
  from.setFullYear(to.getFullYear() - 1);

  const data = await fetchTwelveData<TDTimeSeriesResponse>('/time_series', {
    symbol: symbol.toUpperCase(),
    interval: '1day',
    start_date: from.toISOString().split('T')[0],
    end_date: to.toISOString().split('T')[0],
    outputsize: '365',
  });

  if (!data || !data.values || data.values.length === 0) {
    return [];
  }

  // values 是倒序（最新在前），反转为正序后返回每日数据
  return ([...data.values] as TDValue[])
    .reverse()
    .map(v => ({
      date: v.datetime.split(' ')[0], // 取 YYYY-MM-DD 部分
      price: parseFloat(v.close),
    }));
}

/**
 * 获取从指定日期到今天的每日价格历史（用于指数对比）
 * @param symbol 股票代码（如 SPY、QQQ）
 * @param fromDate 开始日期 YYYY-MM-DD
 */
export async function getIndexHistory(symbol: string, fromDate: string): Promise<{ date: string; price: number }[]> {
  const endDate = new Date();
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const endDateLabel = endDate.toISOString().split('T')[0];

  if (fromDate > endDateLabel) {
    return [];
  }

  const data = await fetchTwelveData<TDTimeSeriesResponse>('/time_series', {
    symbol: symbol.toUpperCase(),
    interval: '1day',
    start_date: fromDate,
    end_date: endDateLabel,
    outputsize: '5000',
  });

  if (!data || !data.values || data.values.length === 0) {
    return [];
  }

  return ([...data.values] as TDValue[])
    .reverse()
    .map(v => ({
      date: v.datetime.split(' ')[0],
      price: parseFloat(v.close),
    }));
}

// ---- Dividends ----

export interface DividendData {
  symbol: string;
  ex_date: string;
  payment_date?: string;
  amount: number;
  currency?: string;
}

export function getDividendProviderSupportStatus(): TwelveDataDividendSupport {
  if (baseDividendSupport === 'missing') return 'missing';
  if (Date.now() < unsupportedUntil) return 'unsupported';
  return baseDividendSupport;
}

/**
 * 获取股票分红数据
 * @param symbol 股票代码
 * @param startDate 开始日期 YYYY-MM-DD (可选)
 * @param endDate 结束日期 YYYY-MM-DD (可选)
 */
export async function getDividends(
  symbol: string,
  startDate?: string,
  endDate?: string
): Promise<{ ok: boolean; data: DividendData[] }> {
  const supportStatus = getDividendProviderSupportStatus();
  if (supportStatus === 'missing' || supportStatus === 'unsupported') {
    return { ok: false, data: [] };
  }

  const params: Record<string, string> = {
    symbol: symbol.toUpperCase(),
  };

  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const url = new URL(`${BASE_URL}/dividends`);
  url.searchParams.append('apikey', API_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 60 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json() as {
      status?: string;
      code?: number;
      message?: string;
    } & TDDividendsResponse;

    const message = data.message ?? '';
    if (
      response.status === 403
      || message.includes('available exclusively with grow or pro')
    ) {
      console.info('Twelve Data dividends disabled: current API plan does not include /dividends.');
      unsupportedUntil = Date.now() + UNSUPPORTED_TTL_MS;
      return { ok: false, data: [] };
    }

    if (response.status === 429 || data.code === 429) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_TTL_MS;
    }

    if (!response.ok || data.status === 'error' || data.code === 429) {
      console.warn(`Twelve Data API error: ${message || `${response.status} ${response.statusText}`} for /dividends`);
      return { ok: false, data: [] };
    }

    baseDividendSupport = 'supported';
    unsupportedUntil = 0;

    if (!data.dividends || data.dividends.length === 0) {
      return { ok: true, data: [] };
    }

    return {
      ok: true,
      data: data.dividends.map((d) => ({
        symbol: data.symbol || symbol.toUpperCase(),
        ex_date: d.ex_date,
        payment_date: d.payment_date,
        amount: parseFloat(d.amount),
        currency: data.currency,
      })),
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Twelve Data fetch exception for /dividends:`, message);
    return { ok: false, data: [] };
  }
}
