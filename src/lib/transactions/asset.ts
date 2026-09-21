import type { Prisma } from '@prisma/client';
import { inferCurrencyFromTicker, inferMarketFromTicker, normalizeTicker } from './ticker';

type AssetWriter = {
  asset: { upsert: Prisma.AssetDelegate['upsert'] };
};

export async function resolveOrCreateAsset(db: AssetWriter, input: { ticker: string }) {
  const ticker = normalizeTicker(input.ticker);
  if (!ticker) throw new Error('Invalid asset ticker');

  // Shared profiles must never come from user-supplied trade metadata.
  // Use a neutral ticker label and deterministic server defaults until provider sync.
  // Trade currency remains on the user's transaction, independently of this profile.
  return db.asset.upsert({
    where: { ticker },
    create: {
      ticker,
      name: ticker,
      market: inferMarketFromTicker(ticker),
      currency: inferCurrencyFromTicker(ticker),
    },
    update: {},
    select: { id: true, ticker: true, name: true, market: true, currency: true },
  });
}
