ALTER TABLE "Portfolio"
ADD COLUMN IF NOT EXISTS "lastDividendSyncAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "userId" TEXT,
ADD COLUMN IF NOT EXISTS "preferences" TEXT,
ADD COLUMN IF NOT EXISTS "settingsUpdatedAt" TIMESTAMP(3);

ALTER TABLE "Asset"
ADD COLUMN IF NOT EXISTS "historyLastUpdated" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "logo" TEXT,
ADD COLUMN IF NOT EXISTS "lastPrice" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "lastPriceUpdated" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "dayHigh" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "dayLow" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "dayOpen" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "metrics" TEXT,
ADD COLUMN IF NOT EXISTS "prevClose" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "priceChange" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "priceChangePercent" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "profile" TEXT;

ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "priceUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "AssetPriceHistory" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AssetPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IndexPriceHistory" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "IndexPriceHistory_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AssetPriceHistory_ticker_fkey'
  ) THEN
    ALTER TABLE "AssetPriceHistory"
    ADD CONSTRAINT "AssetPriceHistory_ticker_fkey"
    FOREIGN KEY ("ticker") REFERENCES "Asset"("ticker")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AssetPriceHistory_ticker_date_key"
ON "AssetPriceHistory"("ticker", "date");

CREATE INDEX IF NOT EXISTS "AssetPriceHistory_ticker_date_idx"
ON "AssetPriceHistory"("ticker", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "IndexPriceHistory_ticker_date_key"
ON "IndexPriceHistory"("ticker", "date");

CREATE INDEX IF NOT EXISTS "IndexPriceHistory_ticker_date_idx"
ON "IndexPriceHistory"("ticker", "date");
