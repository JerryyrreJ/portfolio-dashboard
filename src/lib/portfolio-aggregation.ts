export type CostBasisMethod = 'FIFO' | 'AVCO';

export interface AggregationAsset {
  ticker: string;
  name: string;
  market?: string | null;
  logo?: string | null;
  lastPrice?: number | null;
}

export interface AggregationTransaction {
  portfolioId: string;
  date: Date | string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  quantity: number;
  price: number;
  fee: number;
  asset: AggregationAsset;
}

export interface AggregatedHolding {
  ticker: string;
  name: string;
  market: string;
  price: number;
  qty: number;
  value: number;
  totalCost: number;
  capGain: number;
  return: number;
  dividendIncome: number;
  logo?: string | null;
}

export interface AggregatedHoldingsGroup {
  market: string;
  holdings: AggregatedHolding[];
}

export interface AggregatedSummary {
  totalValue: number;
  totalCapGain: number;
  totalCapGainPercentage: number;
  totalRealizedGain: number;
  totalDividendIncome: number;
}

export interface AggregatedPortfolioDashboard {
  holdings: AggregatedHoldingsGroup[];
  summary: AggregatedSummary;
}

type HoldingLot = {
  qty: number;
  unitCost: number;
};

type HoldingAccumulator = {
  asset: AggregationAsset;
  qty: number;
  cost: number;
  realizedGain: number;
  dividendIncome: number;
  lots: HoldingLot[];
  lastSeenPrice: number;
};

function getAccumulatorKey(portfolioId: string, ticker: string) {
  return `${portfolioId}::${ticker}`;
}

export function parseCostBasisMethod(preferences?: string | null): CostBasisMethod {
  if (!preferences) return 'FIFO';

  try {
    const parsed = JSON.parse(preferences) as { costBasisMethod?: string };
    return parsed.costBasisMethod === 'AVCO' ? 'AVCO' : 'FIFO';
  } catch {
    return 'FIFO';
  }
}

export function deriveAggregatedPortfolioDashboard(
  transactions: AggregationTransaction[],
  options?: {
    livePrices?: Record<string, number>;
    getCostBasisMethodForPortfolio?: (portfolioId: string) => CostBasisMethod;
  },
): AggregatedPortfolioDashboard {
  const livePrices = options?.livePrices ?? {};
  const getCostBasisMethodForPortfolio = options?.getCostBasisMethodForPortfolio
    ?? (() => 'FIFO' as const);

  const byPortfolioTicker = new Map<string, HoldingAccumulator>();
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  for (const transaction of sortedTransactions) {
    const ticker = transaction.asset.ticker;
    const key = getAccumulatorKey(transaction.portfolioId, ticker);

    if (!byPortfolioTicker.has(key)) {
      byPortfolioTicker.set(key, {
        asset: transaction.asset,
        qty: 0,
        cost: 0,
        realizedGain: 0,
        dividendIncome: 0,
        lots: [],
        lastSeenPrice: transaction.asset.lastPrice ?? transaction.price,
      });
    }

    const current = byPortfolioTicker.get(key);
    if (!current) continue;

    const costBasisMethod = getCostBasisMethodForPortfolio(transaction.portfolioId);

    if (transaction.type === 'BUY') {
      const qty = Number(transaction.quantity);
      if (qty <= 0) continue;

      const unitCost = Number(transaction.price) + Number(transaction.fee) / qty;
      current.qty += qty;
      current.cost += qty * unitCost;
      current.lastSeenPrice = transaction.asset.lastPrice ?? transaction.price;

      if (costBasisMethod === 'FIFO') {
        current.lots.push({ qty, unitCost });
      }
    } else if (transaction.type === 'SELL') {
      const sellQty = Number(transaction.quantity);
      const sellPrice = Number(transaction.price);
      const sellFee = Number(transaction.fee);

      if (costBasisMethod === 'FIFO') {
        let remaining = sellQty;
        let costOfSold = 0;

        while (remaining > 0 && current.lots.length > 0) {
          const lot = current.lots[0];
          const consumed = Math.min(remaining, lot.qty);
          costOfSold += consumed * lot.unitCost;
          lot.qty -= consumed;
          remaining -= consumed;

          if (lot.qty <= 0) {
            current.lots.shift();
          }
        }

        current.realizedGain += (sellPrice * sellQty - sellFee) - costOfSold;
        current.qty -= sellQty;
        current.cost = current.lots.reduce((sum, lot) => sum + lot.qty * lot.unitCost, 0);
      } else {
        const avgCost = current.qty > 0 ? current.cost / current.qty : 0;
        current.realizedGain += (sellPrice - avgCost) * sellQty - sellFee;
        current.qty -= sellQty;
        current.cost -= avgCost * sellQty;
      }

      if (current.qty <= 0) {
        current.qty = 0;
        current.cost = 0;
        current.lots = [];
      }

      current.lastSeenPrice = transaction.asset.lastPrice ?? transaction.price;
    } else if (transaction.type === 'DIVIDEND') {
      current.dividendIncome += Number(transaction.price) * Number(transaction.quantity);
      current.lastSeenPrice = transaction.asset.lastPrice ?? current.lastSeenPrice;
    }
  }

  let totalRealizedGain = 0;
  let totalDividendIncome = 0;
  const mergedHoldingsByTicker = new Map<string, AggregatedHolding>();

  for (const accumulator of byPortfolioTicker.values()) {
    totalRealizedGain += accumulator.realizedGain;
    totalDividendIncome += accumulator.dividendIncome;

    if (accumulator.qty <= 0) {
      continue;
    }

    const currentPrice = livePrices[accumulator.asset.ticker]
      ?? accumulator.asset.lastPrice
      ?? accumulator.lastSeenPrice
      ?? 0;

    const existing = mergedHoldingsByTicker.get(accumulator.asset.ticker);
    if (!existing) {
      mergedHoldingsByTicker.set(accumulator.asset.ticker, {
        ticker: accumulator.asset.ticker,
        name: accumulator.asset.name,
        market: accumulator.asset.market || 'US',
        price: currentPrice,
        qty: accumulator.qty,
        value: currentPrice * accumulator.qty,
        totalCost: accumulator.cost,
        capGain: currentPrice * accumulator.qty - accumulator.cost,
        return: accumulator.cost > 0 ? ((currentPrice * accumulator.qty - accumulator.cost) / accumulator.cost) * 100 : 0,
        dividendIncome: accumulator.dividendIncome,
        logo: accumulator.asset.logo ?? null,
      });
      continue;
    }

    existing.qty += accumulator.qty;
    existing.totalCost += accumulator.cost;
    existing.value = currentPrice * existing.qty;
    existing.capGain = existing.value - existing.totalCost;
    existing.return = existing.totalCost > 0 ? (existing.capGain / existing.totalCost) * 100 : 0;
    existing.dividendIncome += accumulator.dividendIncome;
    existing.price = currentPrice;
  }

  const holdings = Array.from(mergedHoldingsByTicker.values());
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.totalCost, 0);
  const totalCapGain = totalValue - totalCost;
  const markets = Array.from(new Set(holdings.map((holding) => holding.market)));

  return {
    holdings: markets.map((market) => ({
      market,
      holdings: holdings.filter((holding) => holding.market === market),
    })),
    summary: {
      totalValue,
      totalCapGain,
      totalCapGainPercentage: totalCost > 0 ? (totalCapGain / totalCost) * 100 : 0,
      totalRealizedGain,
      totalDividendIncome,
    },
  };
}
