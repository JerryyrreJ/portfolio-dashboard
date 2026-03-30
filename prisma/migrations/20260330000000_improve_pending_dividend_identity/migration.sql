CREATE TABLE IF NOT EXISTS "PendingDividend" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "exDate" DATE NOT NULL,
    "payDate" DATE,
    "sourceKey" TEXT,
    "sharesHeld" DOUBLE PRECISION NOT NULL,
    "dividendPerShare" DOUBLE PRECISION NOT NULL,
    "calculatedAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingDividend_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PendingDividend_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "PendingDividend"
ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;

UPDATE "PendingDividend"
SET "sourceKey" = CONCAT(
  COALESCE(TO_CHAR("payDate", 'YYYY-MM-DD'), ''),
  ':',
  COALESCE("currency", 'USD'),
  ':',
  ROUND(("dividendPerShare"::numeric) * 100000000)::bigint
)
WHERE "sourceKey" IS NULL;

ALTER TABLE "PendingDividend"
ALTER COLUMN "sourceKey" SET NOT NULL;

DROP INDEX IF EXISTS "PendingDividend_portfolioId_ticker_exDate_key";

CREATE INDEX IF NOT EXISTS "PendingDividend_portfolioId_status_idx"
ON "PendingDividend"("portfolioId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "PendingDividend_portfolioId_ticker_exDate_sourceKey_key"
ON "PendingDividend"("portfolioId", "ticker", "exDate", "sourceKey");
