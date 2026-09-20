import type { Prisma } from '@prisma/client';

type AssetWriter = {
  asset: {
    upsert: Prisma.AssetDelegate['upsert'];
  };
};

export async function resolveOrCreateAsset(
  db: AssetWriter,
  input: {
    ticker: string;
    name: string;
    market: string;
    currency: string;
  }
) {
  // Match sync/push: ticker is the identity. Existing asset profile fields stay server-owned.
  return db.asset.upsert({
    where: { ticker: input.ticker },
    create: {
      ticker: input.ticker,
      name: input.name || input.ticker,
      market: input.market || 'US',
      currency: input.currency || 'USD',
    },
    update: {},
    select: {
      id: true,
      ticker: true,
      name: true,
      market: true,
    },
  });
}
