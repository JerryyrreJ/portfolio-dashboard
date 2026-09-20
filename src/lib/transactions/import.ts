import { getPriceUSD } from '@/lib/exchange-rate';
import prisma from '@/lib/prisma';
import { resolveOrCreateAsset } from '@/lib/transactions/asset';
import {
  IMPORT_SOURCE,
  type ParsedImportItem,
  toNormalizedPreview,
} from '@/lib/transactions/parse';

const NUMBER_EPSILON = 1e-9;

type TradeSnapshot = {
  id: string;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  date: Date;
  currency: string;
  notes: string | null;
  importKey: string | null;
  asset: {
    ticker: string;
    name: string;
    market: string;
  };
};

export type ImportItemResult = {
  index: number;
  status: 'valid' | 'created' | 'existing';
  transaction?: ReturnType<typeof serializeTrade>;
  normalized?: ReturnType<typeof toNormalizedPreview>;
};

function isSameNumber(left: number, right: number) {
  return Math.abs(left - right) <= NUMBER_EPSILON;
}

function serializeTrade(transaction: TradeSnapshot) {
  return {
    id: transaction.id,
    type: transaction.type,
    quantity: transaction.quantity,
    price: transaction.price,
    fee: transaction.fee,
    date: transaction.date.toISOString(),
    currency: transaction.currency,
    notes: transaction.notes,
    clientKey: transaction.importKey,
    asset: {
      ticker: transaction.asset.ticker,
      name: transaction.asset.name,
      market: transaction.asset.market,
    },
  };
}

function matchesExisting(item: ParsedImportItem, existing: TradeSnapshot) {
  return (
    existing.type === item.type &&
    existing.asset.ticker === item.ticker &&
    isSameNumber(existing.quantity, item.quantity) &&
    isSameNumber(existing.price, item.price) &&
    isSameNumber(existing.fee, item.fee) &&
    existing.date.getTime() === item.date.getTime() &&
    existing.currency === item.currency &&
    (existing.notes ?? null) === item.notes
  );
}

async function ratesByCurrency(items: ParsedImportItem[]) {
  const unique = [...new Set(items.map((item) => item.currency))];
  const entries = await Promise.all(
    unique.map(async (currency) => {
      const { exchangeRate } = await getPriceUSD(1, currency);
      return [currency, exchangeRate] as const;
    })
  );
  return Object.fromEntries(entries) as Record<string, number>;
}

export function previewImportItems(items: ParsedImportItem[]): ImportItemResult[] {
  return items.map((item) => ({
    index: item.index,
    status: 'valid',
    normalized: toNormalizedPreview(item),
  }));
}

export async function importTransactionsAtomically(input: {
  portfolioId: string;
  items: ParsedImportItem[];
}): Promise<{ results: ImportItemResult[]; conflicts: Array<{ index: number; field: string; code: string; message: string }> }> {
  const rates = await ratesByCurrency(input.items);
  const clientKeys = input.items
    .map((item) => item.clientKey)
    .filter((key): key is string => Boolean(key));

  const existing = clientKeys.length === 0
    ? []
    : await prisma.transaction.findMany({
        where: {
          portfolioId: input.portfolioId,
          importKey: { in: clientKeys },
        },
        select: {
          id: true,
          type: true,
          quantity: true,
          price: true,
          fee: true,
          date: true,
          currency: true,
          notes: true,
          importKey: true,
          asset: {
            select: {
              ticker: true,
              name: true,
              market: true,
            },
          },
        },
      });

  const existingByKey = new Map(
    existing
      .filter((row) => row.importKey)
      .map((row) => [row.importKey as string, row])
  );

  const conflicts: Array<{ index: number; field: string; code: string; message: string }> = [];
  for (const item of input.items) {
    if (!item.clientKey) continue;
    const previous = existingByKey.get(item.clientKey);
    if (previous && !matchesExisting(item, previous)) {
      conflicts.push({
        index: item.index,
        field: 'clientKey',
        code: 'CLIENT_KEY_CONFLICT',
        message: 'clientKey already exists on a different transaction in this portfolio.',
      });
    }
  }

  if (conflicts.length > 0) {
    return { results: [], conflicts };
  }

  const created = await prisma.$transaction(async (tx) => {
    const results: ImportItemResult[] = [];

    for (const item of input.items) {
      if (item.clientKey) {
        const previous = existingByKey.get(item.clientKey);
        if (previous) {
          results.push({
            index: item.index,
            status: 'existing',
            transaction: serializeTrade(previous),
          });
          continue;
        }
      }

      const asset = await resolveOrCreateAsset(tx, {
        ticker: item.ticker,
        name: item.name,
        market: item.market,
        currency: item.currency,
      });

      const exchangeRate = rates[item.currency] ?? 1;
      const transaction = await tx.transaction.create({
        data: {
          portfolioId: input.portfolioId,
          assetId: asset.id,
          type: item.type,
          quantity: item.quantity,
          price: item.price,
          fee: item.fee,
          date: item.date,
          currency: item.currency,
          exchangeRate,
          priceUSD: item.price / exchangeRate,
          notes: item.notes,
          source: IMPORT_SOURCE,
          importKey: item.clientKey,
        },
        select: {
          id: true,
          type: true,
          quantity: true,
          price: true,
          fee: true,
          date: true,
          currency: true,
          notes: true,
          importKey: true,
        },
      });

      const snapshot: TradeSnapshot = {
        ...transaction,
        asset,
      };

      if (item.clientKey) {
        existingByKey.set(item.clientKey, snapshot);
      }

      results.push({
        index: item.index,
        status: 'created',
        transaction: serializeTrade(snapshot),
      });
    }

    return results;
  }, {
    timeout: 15_000,
  });

  return { results: created, conflicts: [] };
}

export type PersistSessionTradeInput = {
  portfolioId: string;
  assetId: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  date: Date;
  currency: string;
  notes: string | null;
};

export async function persistSessionTrade(input: PersistSessionTradeInput) {
  const { priceUSD, exchangeRate } = await getPriceUSD(input.price, input.currency);

  return prisma.transaction.create({
    data: {
      portfolioId: input.portfolioId,
      assetId: input.assetId,
      type: input.type,
      quantity: input.quantity,
      price: input.price,
      fee: input.fee,
      date: input.date,
      currency: input.currency,
      exchangeRate,
      priceUSD,
      notes: input.notes,
    },
    include: {
      asset: true,
      portfolio: true,
    },
  });
}
