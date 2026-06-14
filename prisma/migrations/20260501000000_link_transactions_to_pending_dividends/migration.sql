ALTER TABLE "PendingDividend"
ADD COLUMN IF NOT EXISTS "confirmedAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "confirmationMode" TEXT,
ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ignoredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);

ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "pendingDividendId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Transaction_pendingDividendId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_pendingDividendId_fkey"
    FOREIGN KEY ("pendingDividendId") REFERENCES "PendingDividend"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Transaction_pendingDividendId_idx"
ON "Transaction"("pendingDividendId");

UPDATE "PendingDividend"
SET
  "confirmedAt" = COALESCE("confirmedAt", "updatedAt"),
  "confirmationMode" = COALESCE(
    "confirmationMode",
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM "Transaction" t
        WHERE t."portfolioId" = "PendingDividend"."portfolioId"
          AND t."eventId" IS NOT NULL
          AND (
            t."subtype" = 'REINVESTED_DIVIDEND'
            OR (t."type" = 'DIVIDEND' AND t."source" = 'drip')
          )
          AND t."notes" = CONCAT(
            'Reinvested dividend: ',
            "PendingDividend"."sharesHeld",
            ' shares × ',
            "PendingDividend"."dividendPerShare",
            ' per share'
          )
      ) THEN 'reinvest'
      WHEN "status" = 'confirmed' THEN 'cash'
      ELSE NULL
    END
  ),
  "confirmedAmount" = COALESCE(
    "confirmedAmount",
    (
      SELECT t."price"
      FROM "Transaction" t
      WHERE t."portfolioId" = "PendingDividend"."portfolioId"
        AND t."type" = 'DIVIDEND'
        AND (
          t."notes" = CONCAT(
            'Dividend: ',
            "PendingDividend"."sharesHeld",
            ' shares × ',
            "PendingDividend"."dividendPerShare",
            ' per share'
          )
          OR t."notes" = CONCAT(
            'Reinvested dividend: ',
            "PendingDividend"."sharesHeld",
            ' shares × ',
            "PendingDividend"."dividendPerShare",
            ' per share'
          )
        )
      ORDER BY ABS(EXTRACT(EPOCH FROM (t."date" - COALESCE("PendingDividend"."payDate", "PendingDividend"."exDate"))))
      LIMIT 1
    )
  ),
  "ignoredAt" = CASE
    WHEN "status" = 'ignored' AND "ignoredAt" IS NULL THEN "updatedAt"
    ELSE "ignoredAt"
  END,
  "voidedAt" = CASE
    WHEN "status" = 'voided' AND "voidedAt" IS NULL THEN "updatedAt"
    ELSE "voidedAt"
  END
WHERE "status" IN ('confirmed', 'ignored', 'voided');

WITH dividend_matches AS (
  SELECT
    t."id" AS "transactionId",
    pd."id" AS "pendingDividendId"
  FROM "Transaction" t
  JOIN "PendingDividend" pd
    ON pd."portfolioId" = t."portfolioId"
   AND t."type" = 'DIVIDEND'
   AND t."pendingDividendId" IS NULL
   AND (
     t."notes" = CONCAT(
       'Dividend: ',
       pd."sharesHeld",
       ' shares × ',
       pd."dividendPerShare",
       ' per share'
     )
     OR t."notes" = CONCAT(
       'Reinvested dividend: ',
       pd."sharesHeld",
       ' shares × ',
       pd."dividendPerShare",
       ' per share'
     )
   )
   AND ABS(EXTRACT(EPOCH FROM (t."date" - COALESCE(pd."payDate", pd."exDate")))) <= 86400
)
UPDATE "Transaction" t
SET "pendingDividendId" = dm."pendingDividendId"
FROM dividend_matches dm
WHERE t."id" = dm."transactionId";

WITH drip_buy_matches AS (
  SELECT
    buy_tx."id" AS "transactionId",
    cash_tx."pendingDividendId" AS "pendingDividendId"
  FROM "Transaction" buy_tx
  JOIN "Transaction" cash_tx
    ON cash_tx."portfolioId" = buy_tx."portfolioId"
   AND cash_tx."eventId" = buy_tx."eventId"
   AND cash_tx."type" = 'DIVIDEND'
   AND cash_tx."pendingDividendId" IS NOT NULL
  WHERE buy_tx."type" = 'BUY'
    AND buy_tx."pendingDividendId" IS NULL
    AND buy_tx."eventId" IS NOT NULL
    AND (
      buy_tx."subtype" = 'DRIP'
      OR buy_tx."source" = 'drip'
    )
)
UPDATE "Transaction" t
SET "pendingDividendId" = dm."pendingDividendId"
FROM drip_buy_matches dm
WHERE t."id" = dm."transactionId";
