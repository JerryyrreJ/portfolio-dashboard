/**
 * Twelve Data API 客户端
 * 文档: https://twelvedata.com/docs
 */

const API_KEY = process.env.TWELVEDATA_API_KEY || '';
const BASE_URL = 'https://api.twelvedata.com';

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
let isRateLimited = false;

export function isTwelveDataRateLimited() {
  return isRateLimited;
}

export function resetTwelveDataRateLimit() {
  isRateLimited = false;
}

async function fetchTwelveData(endpoint: string, params: Record<string, string> = {}) {
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
      isRateLimited = true;
    }

    if (!response.ok) {
      console.warn(`Twelve Data API error: ${response.status} ${response.statusText} for ${endpoint}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'error' || data.code === 429) {
      if (data.code === 429 || data.message?.includes('rate limit')) {
        isRateLimited = true;
      }
      console.warn(`Twelve Data API error: ${data.message} for ${endpoint}`);
      return null;
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn(`Twelve Data fetch exception for ${endpoint}:`, error.message || error);
    return null;
  }
}

/**
 * 获取公司 Logo URL
 * @param symbol 股票代码
 */
export async function getLogo(symbol: string): Promise<string | null> {
  const data = await fetchTwelveData('/logo', {
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

  const data = await fetchTwelveData('/time_series', {
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
  const data = await fetchTwelveData('/quote', {
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

  const data = await fetchTwelveData('/time_series', {
    symbol: symbol.toUpperCase(),
    interval: '1day',
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate,
    outputsize: '10',
  });

  if (data?.values?.length > 0) {
    return parseFloat(data.values[0].close); // 最新在前
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

  const data = await fetchTwelveData('/time_series', {
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

// ---- Dividends ----

export interface DividendData {
  symbol: string;
  ex_date: string;
  payment_date?: string;
  amount: number;
  currency?: string;
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
): Promise<DividendData[]> {
  const params: Record<string, string> = {
    symbol: symbol.toUpperCase(),
  };

  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const data = await fetchTwelveData('/dividends', params);

  if (!data || !data.dividends || data.dividends.length === 0) {
    return [];
  }

  return data.dividends.map((d: any) => ({
    symbol: data.symbol || symbol.toUpperCase(),
    ex_date: d.ex_date,
    payment_date: d.payment_date,
    amount: parseFloat(d.amount),
    currency: data.currency,
  }));
}
