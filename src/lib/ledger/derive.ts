import type { LedgerPortfolioRecord, LedgerTransactionRecord } from '@/lib/ledger/types';

export interface DerivedHolding {
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

export interface DerivedHoldingsGroup {
  market: string;
  holdings: DerivedHolding[];
}

export interface DerivedSummary {
  totalValue: number;
  totalCapGain: number;
  totalCapGainPercentage: number;
  totalRealizedGain: number;
  totalDividendIncome: number;
}

export interface DerivedPortfolioDashboard {
  holdings: DerivedHoldingsGroup[];
  summary: DerivedSummary;
}

type HoldingLot = {
  qty: number;
  unitCost: number;
};

type HoldingAccumulator = {
  asset: LedgerTransactionRecord['asset'];
  qty: number;
  cost: number;
  price: number;
  realizedGain: number;
  dividendIncome: number;
  lots: HoldingLot[];
};

export function derivePortfolioDashboard(
  transactions: LedgerTransactionRecord[],
  livePrices: Record<string, number>,
  costBasisMethod: 'FIFO' | 'AVCO' = 'FIFO',
): DerivedPortfolioDashboard {
  const byTicker = new Map<string, HoldingAccumulator>();

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  for (const transaction of sortedTransactions) {
    const ticker = transaction.asset.ticker;
    if (!byTicker.has(ticker)) {
      byTicker.set(ticker, {
        asset: transaction.asset,
        qty: 0,
        cost: 0,
        price: transaction.price,
        realizedGain: 0,
        dividendIncome: 0,
        lots: [],
      });
    }

    const current = byTicker.get(ticker);
    if (!current) continue;

    if (transaction.type === 'BUY') {
      const qty = Number(transaction.quantity);
      if (qty <= 0) continue;
      const unitCost = Number(transaction.price) + Number(transaction.fee) / qty;
      current.qty += qty;
      current.cost += qty * unitCost;
      current.price = transaction.price;
      if (costBasisMethod === 'FIFO') current.lots.push({ qty, unitCost });
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
          if (lot.qty <= 0) current.lots.shift();
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
      current.price = transaction.price;
    } else if (transaction.type === 'DIVIDEND') {
      current.dividendIncome += Number(transaction.price) * Number(transaction.quantity);
    }
  }

  let totalValue = 0;
  let totalCost = 0;
  let totalRealizedGain = 0;
  let totalDividendIncome = 0;

  const holdings = Array.from(byTicker.values())
    .filter((holding) => holding.qty > 0)
    .map<DerivedHolding>((holding) => {
      const livePrice = livePrices[holding.asset.ticker] ?? holding.price;
      const value = livePrice * holding.qty;
      const capGain = value - holding.cost;
      const returnPct = holding.cost > 0 ? (capGain / holding.cost) * 100 : 0;

      totalValue += value;
      totalCost += holding.cost;
      totalRealizedGain += holding.realizedGain;
      totalDividendIncome += holding.dividendIncome;

      return {
        ticker: holding.asset.ticker,
        name: holding.asset.name,
        market: holding.asset.market || 'US',
        price: livePrice,
        qty: holding.qty,
        value,
        totalCost: holding.cost,
        capGain,
        return: returnPct,
        dividendIncome: holding.dividendIncome,
        logo: holding.asset.logo ?? null,
      };
    });

  const markets = Array.from(new Set(holdings.map((holding) => holding.market)));
  return {
    holdings: markets.map((market) => ({
      market,
      holdings: holdings.filter((holding) => holding.market === market),
    })),
    summary: {
      totalValue,
      totalCapGain: totalValue - totalCost,
      totalCapGainPercentage: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      totalRealizedGain,
      totalDividendIncome,
    },
  };
}

export function derivePortfolioName(
  portfolios: LedgerPortfolioRecord[],
  portfolioId?: string,
) {
  if (portfolioId) {
    return portfolios.find((portfolio) => portfolio.id === portfolioId)?.name ?? portfolios[0]?.name ?? 'My Portfolio';
  }
  return portfolios[0]?.name ?? 'My Portfolio';
}
