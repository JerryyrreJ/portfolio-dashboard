import { getPriceOnOrBefore } from '@/lib/portfolio-chart';

export interface DashboardChartAsset {
  ticker: string;
  name: string;
  market: string;
  lastPrice: number | null;
}

export interface DashboardChartTransaction {
  portfolioId: string;
  date: Date | string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  quantity: number;
  price: number;
  fee: number;
  asset: DashboardChartAsset;
}

export interface DashboardChartPoint {
  date: string;
  Total?: number;
  Local?: number;
  Return?: number;
  SPY?: number | null;
  QQQ?: number | null;
}

type HistoricalPoint = {
  date: string;
  price: number;
};

export function buildDashboardChartData({
  transactions,
  priceHistories,
  indexPriceHistories,
  livePrices,
  totalValue,
}: {
  transactions: DashboardChartTransaction[];
  priceHistories: Record<string, HistoricalPoint[]>;
  indexPriceHistories: Record<string, HistoricalPoint[]>;
  livePrices: Map<string, number>;
  totalValue: number;
}) {
  const allDateLabels = Array.from(
    new Set(Object.values(priceHistories).flatMap((history) => history.map((point) => point.date))),
  ).sort();

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const holdingsAtDate = new Map<string, number>();
  let txIndex = 0;
  let cumulativeReturnFactor = 1.0;

  const historicalChartData = allDateLabels.map((dateLabel, index) => {
    const dayEnd = new Date(`${dateLabel}T23:59:59Z`);
    const holdingsBeforeTx = new Map(holdingsAtDate);

    while (txIndex < sortedTransactions.length && new Date(sortedTransactions[txIndex].date) <= dayEnd) {
      const transaction = sortedTransactions[txIndex];
      const ticker = transaction.asset.ticker;
      const qty = holdingsAtDate.get(ticker) ?? 0;

      if (transaction.type === 'BUY') holdingsAtDate.set(ticker, qty + transaction.quantity);
      else if (transaction.type === 'SELL') holdingsAtDate.set(ticker, qty - transaction.quantity);

      txIndex++;
    }

    let total = 0;
    for (const [ticker, qty] of holdingsAtDate) {
      if (qty <= 0) continue;
      const dayPrices = priceHistories[ticker];
      if (!dayPrices) continue;
      const price = getPriceOnOrBefore(dayPrices, dateLabel);
      if (price == null) continue;
      total += qty * price;
    }

    if (index > 0) {
      const prevLabel = allDateLabels[index - 1];
      let dailyFactor = 0;
      let weightSum = 0;

      for (const [ticker, qty] of holdingsBeforeTx) {
        if (qty <= 0) continue;
        const dayPrices = priceHistories[ticker];
        if (!dayPrices) continue;
        const todayPrice = getPriceOnOrBefore(dayPrices, dateLabel);
        const prevPrice = getPriceOnOrBefore(dayPrices, prevLabel);
        if (todayPrice == null || prevPrice == null || prevPrice === 0) continue;
        const weight = qty * prevPrice;
        dailyFactor += (todayPrice / prevPrice) * weight;
        weightSum += weight;
      }

      if (weightSum > 0) {
        cumulativeReturnFactor *= dailyFactor / weightSum;
      }
    }

    return {
      date: dateLabel,
      Total: Math.round(total * 100) / 100,
      Return: Math.round((cumulativeReturnFactor - 1) * 10000) / 100,
    };
  }).filter((point) => point.Total > 0);

  const indexTickers = ['SPY', 'QQQ'] as const;
  const indexReturnsByDate = new Map<string, { SPY: number | null; QQQ: number | null }>();
  const firstChartLabel = historicalChartData[0]?.date;
  const indexBaselinePrices: Record<string, number | null> = { SPY: null, QQQ: null };

  if (firstChartLabel) {
    for (const ticker of indexTickers) {
      const prices = indexPriceHistories[ticker];
      if (!prices || prices.length === 0) continue;
      const baseline = getPriceOnOrBefore(prices, firstChartLabel) ?? prices[0]?.price ?? null;
      if (baseline != null && baseline > 0) {
        indexBaselinePrices[ticker] = baseline;
      }
    }
  }

  for (const point of historicalChartData) {
    const pointReturns: { SPY: number | null; QQQ: number | null } = { SPY: null, QQQ: null };

    for (const ticker of indexTickers) {
      const baseline = indexBaselinePrices[ticker];
      const prices = indexPriceHistories[ticker];
      if (baseline == null || !prices || prices.length === 0) continue;

      const todayPrice = getPriceOnOrBefore(prices, point.date);
      if (todayPrice == null || todayPrice <= 0) continue;

      pointReturns[ticker] = Math.round((todayPrice / baseline - 1) * 10000) / 100;
    }

    indexReturnsByDate.set(point.date, pointReturns);
  }

  const historicalChartDataWithIndex = historicalChartData.map((point) => {
    const pointReturns = indexReturnsByDate.get(point.date);
    return {
      ...point,
      SPY: pointReturns?.SPY ?? null,
      QQQ: pointReturns?.QQQ ?? null,
    };
  });

  const lastHistorical = historicalChartDataWithIndex[historicalChartDataWithIndex.length - 1];
  let todayReturnFactor = cumulativeReturnFactor;

  if (lastHistorical) {
    const lastLabel = lastHistorical.date;
    let dailyFactor = 0;
    let weightSum = 0;

    for (const [ticker, qty] of holdingsAtDate) {
      if (qty <= 0) continue;
      const dayPrices = priceHistories[ticker];
      if (!dayPrices) continue;
      const prevPrice = getPriceOnOrBefore(dayPrices, lastLabel);
      const livePrice = livePrices.get(ticker);
      if (prevPrice == null || livePrice == null || prevPrice === 0) continue;
      const weight = qty * prevPrice;
      dailyFactor += (livePrice / prevPrice) * weight;
      weightSum += weight;
    }

    if (weightSum > 0) {
      todayReturnFactor *= dailyFactor / weightSum;
    }
  }

  const todayIndexReturns: Record<string, number | null> = { SPY: null, QQQ: null };
  for (const ticker of indexTickers) {
    const lastValue = historicalChartDataWithIndex[historicalChartDataWithIndex.length - 1]?.[ticker] ?? null;
    if (lastValue != null) {
      todayIndexReturns[ticker] = lastValue;
    }
  }

  return [
    ...historicalChartDataWithIndex,
    {
      date: 'Today',
      Total: Math.round(totalValue * 100) / 100,
      Return: Math.round((todayReturnFactor - 1) * 10000) / 100,
      SPY: todayIndexReturns.SPY,
      QQQ: todayIndexReturns.QQQ,
    },
  ] satisfies DashboardChartPoint[];
}
