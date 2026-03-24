-- Remove orphaned pending dividends before enforcing the foreign key.
DELETE FROM "PendingDividend"
WHERE "portfolioId" NOT IN (
    SELECT "id" FROM "Portfolio"
);

-- Enforce that every pending dividend belongs to a real portfolio.
ALTER TABLE "PendingDividend"
ADD CONSTRAINT "PendingDividend_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
