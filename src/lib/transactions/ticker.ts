export function inferCurrencyFromTicker(symbol: string): string {
  const ticker = symbol.toUpperCase();
  if (ticker.endsWith('.HK')) return 'HKD';
  if (ticker.endsWith('.SS') || ticker.endsWith('.SZ')) return 'CNY';
  if (ticker.endsWith('.L') || ticker.endsWith('.LON')) return 'GBP';
  if (ticker.endsWith('.T')) return 'JPY';
  if (ticker.endsWith('.AX')) return 'AUD';
  if (ticker.endsWith('.TO') || ticker.endsWith('.V')) return 'CAD';
  if (ticker.endsWith('.SW')) return 'CHF';
  if (ticker.endsWith('.SI')) return 'SGD';
  return 'USD';
}

export function inferMarketFromTicker(symbol: string): string {
  const ticker = symbol.toUpperCase();
  if (ticker.endsWith('.HK')) return 'HK';
  if (ticker.endsWith('.SS') || ticker.endsWith('.SZ')) return 'CN';
  if (ticker.endsWith('.L') || ticker.endsWith('.LON')) return 'UK';
  if (ticker.endsWith('.T')) return 'JP';
  if (ticker.endsWith('.AX')) return 'AU';
  if (ticker.endsWith('.TO') || ticker.endsWith('.V')) return 'CA';
  if (ticker.endsWith('.SW')) return 'CH';
  if (ticker.endsWith('.SI')) return 'SG';
  return 'US';
}

export function normalizeTicker(value: unknown) {
  if (typeof value !== 'string') return null;
  const ticker = value.trim().toUpperCase();
  if (!ticker) return null;
  if (ticker.length > 32) return null;
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,31}$/.test(ticker)) return null;
  return ticker;
}
