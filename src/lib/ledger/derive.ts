import type { LedgerPortfolioRecord, LedgerTransactionRecord } from '@/lib/ledger/types';
import {
  deriveAggregatedPortfolioDashboard,
  type AggregatedHoldingsGroup,
  type AggregatedSummary,
} from '@/lib/portfolio-aggregation';

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

export function derivePortfolioDashboard(
  transactions: LedgerTransactionRecord[],
  livePrices: Record<string, number>,
  costBasisMethod: 'FIFO' | 'AVCO' = 'FIFO',
): DerivedPortfolioDashboard {
  const derived = deriveAggregatedPortfolioDashboard(transactions, {
    livePrices,
    getCostBasisMethodForPortfolio: () => costBasisMethod,
  });

  return {
    holdings: derived.holdings as AggregatedHoldingsGroup[],
    summary: derived.summary as AggregatedSummary,
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
