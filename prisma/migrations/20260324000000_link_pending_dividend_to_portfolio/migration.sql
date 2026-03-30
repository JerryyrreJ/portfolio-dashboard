DO $$
BEGIN
  IF to_regclass('"PendingDividend"') IS NOT NULL THEN
    DELETE FROM "PendingDividend"
    WHERE "portfolioId" NOT IN (
      SELECT "id" FROM "Portfolio"
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'PendingDividend_portfolioId_fkey'
    ) THEN
      ALTER TABLE "PendingDividend"
      ADD CONSTRAINT "PendingDividend_portfolioId_fkey"
      FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
