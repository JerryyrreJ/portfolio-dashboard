/**
 * Alpha Vantage API client
 * Official docs: https://www.alphavantage.co/documentation/
 */

const API_KEY = process.env.ALPHAVANTAGE_API_KEY || '';
const BASE_URL = 'https://www.alphavantage.co/query';

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
      console.warn(`Alpha Vantage API error: ${response.status} ${response.statusText} for ${params.function}`);
      return null;
    }

    const data = await response.json() as AlphaVantageDividendResponse;
    if (data.Information || data.Note || data.ErrorMessage) {
      console.warn(
        `Alpha Vantage API error: ${data.Information || data.Note || data.ErrorMessage} for ${params.function}`
      );
      return null;
    }

    return data;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Alpha Vantage fetch exception for ${params.function}:`, message);
    return null;
  }
}

export async function getDividends(
  symbol: string,
  startDate?: string,
  endDate?: string
): Promise<AlphaVantageDividendData[]> {
  const data = await fetchAlphaVantage({
    function: 'DIVIDENDS',
    symbol: symbol.toUpperCase(),
  });

  if (!data?.data?.length) {
    return [];
  }

  return data.data
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
}
