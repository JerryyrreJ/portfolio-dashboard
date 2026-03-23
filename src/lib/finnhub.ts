/**
 * Finnhub API 客户端
 * 文档: https://finnhub.io/docs/api
 */

const API_KEY = process.env.FINNHUB_API_KEY || '';
const BASE_URL = 'https://finnhub.io/api/v1';

// 速率限制追踪
let isRateLimited = false;

export function isFinnhubRateLimited() {
  return isRateLimited;
}

export function resetFinnhubRateLimit() {
  isRateLimited = false;
}

// 统一的请求函数
async function fetchFinnhub(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('token', API_KEY);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒超时

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 60 }, // 缓存 60 秒
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.status === 429) {
      isRateLimited = true;
    }

    if (!response.ok) {
      console.warn(`Finnhub API error: ${response.status} ${response.statusText} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn(`Finnhub fetch exception for ${endpoint}:`, error.message || error);
    return null;
  }
}

// 类型定义
export interface StockQuote {
  c: number; // 当前价格
  d: number; // 价格变动
  dp: number; // 价格变动百分比
  h: number; // 当日最高
  l: number; // 当日最低
  o: number; // 当日开盘
  pc: number; // 昨日收盘
  t: number; // 时间戳
}

export interface StockSearchResult {
  count: number;
  result: Array<{
    description: string;
    displaySymbol: string;
    symbol: string;
    type: string;
  }>;
}

// API 函数

/**
 * 获取股票实时报价
 * @param symbol 股票代码，如 "AAPL"
 */
export async function getQuote(symbol: string): Promise<StockQuote> {
  return fetchFinnhub('/quote', { symbol: symbol.toUpperCase() });
}

/**
 * 搜索股票
 * @param query 搜索关键词，如 "Apple" 或 "AAPL"
 */
export async function searchStock(query: string): Promise<StockSearchResult> {
  return fetchFinnhub('/search', { q: query });
}

/**
 * 批量获取多只股票的实时报价
 * @param symbols 股票代码数组，如 ["AAPL", "GOOGL", "MSFT"]
 */
export async function getBatchQuotes(
  symbols: string[]
): Promise<Record<string, StockQuote>> {
  const results: Record<string, StockQuote> = {};

  for (const symbol of symbols) {
    try {
      const quote = await getQuote(symbol);
      results[symbol] = quote;
    } catch (error) {
      console.error(`Failed to get quote for ${symbol}:`, error);
    }
  }

  return results;
}

// ---- Company Profile ----

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  finnhubIndustry: string;
}

/**
 * 获取公司基本资料
 * @param symbol 股票代码
 */
export async function getCompanyProfile(symbol: string): Promise<CompanyProfile> {
  return fetchFinnhub('/stock/profile2', { symbol: symbol.toUpperCase() });
}

// ---- Company News ----

export interface NewsArticle {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

/**
 * 获取公司新闻
 * @param symbol 股票代码
 * @param from 开始日期 YYYY-MM-DD
 * @param to 结束日期 YYYY-MM-DD
 */
export async function getCompanyNews(
  symbol: string,
  from: string,
  to: string
): Promise<NewsArticle[]> {
  return fetchFinnhub('/company-news', {
    symbol: symbol.toUpperCase(),
    from,
    to,
  });
}

// ---- Basic Financials / Key Metrics ----

export interface BasicFinancials {
  metric: {
    '52WeekHigh'?: number;
    '52WeekLow'?: number;
    '52WeekHighDate'?: string;
    '52WeekLowDate'?: string;
    peBasicExclExtraTTM?: number;
    peNormalizedAnnual?: number;
    epsBasicExclExtraItemsTTM?: number;
    epsTTM?: number;
    dividendYieldIndicatedAnnual?: number;
    beta?: number;
    [key: string]: number | string | undefined;
  };
}

/**
 * 获取股票关键财务指标
 * @param symbol 股票代码
 */
export async function getBasicFinancials(symbol: string): Promise<BasicFinancials> {
  return fetchFinnhub('/stock/metric', {
    symbol: symbol.toUpperCase(),
    metric: 'all',
  });
}

// ---- Dividends ----

export interface DividendInfo {
  symbol: string;
  date: string;
  amount: number;
  adjustedAmount?: number;
  currency?: string;
  declarationDate?: string;
  recordDate?: string;
  payDate?: string;
}

/**
 * 获取股票分红历史
 * @param symbol 股票代码
 * @param from 开始日期 YYYY-MM-DD
 * @param to 结束日期 YYYY-MM-DD
 */
export async function getDividends(
  symbol: string,
  from: string,
  to: string
): Promise<DividendInfo[]> {
  const data = await fetchFinnhub('/stock/dividend', {
    symbol: symbol.toUpperCase(),
    from,
    to,
  });
  return data || [];
}