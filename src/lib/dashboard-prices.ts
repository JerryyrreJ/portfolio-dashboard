type Holding = { ticker: string; qty: number; totalCost: number; price: number; value: number; capGain: number; return: number };
type Summary = { totalValue: number; totalCapGain: number; totalCapGainPercentage: number; totalRealizedGain: number; totalDividendIncome: number };

// Quotes may arrive after transactions change. Always price the current cloud
// holdings, never a captured snapshot from when the quote request began.
export function applyDashboardPrices<T extends Holding, S extends Summary>(
  groups: { market: string; holdings: T[] }[], summary: S, prices: Record<string, number>,
) {
  let totalValue = 0;
  let totalCost = 0;
  const holdings = groups.map(group => ({
    ...group,
    holdings: group.holdings.map(holding => {
      const price = prices[holding.ticker];
      const value = Number.isFinite(price) && price > 0 ? price * holding.qty : holding.value;
      totalValue += value;
      totalCost += holding.totalCost;
      return {
        ...holding, price: Number.isFinite(price) && price > 0 ? price : holding.price,
        value, capGain: value - holding.totalCost,
        return: holding.totalCost > 0 ? (value - holding.totalCost) / holding.totalCost * 100 : 0,
      };
    }),
  }));
  return { holdings, summary: { ...summary, totalValue,
    totalCapGain: totalValue - totalCost,
    totalCapGainPercentage: totalCost > 0 ? (totalValue - totalCost) / totalCost * 100 : 0,
  } };
}
