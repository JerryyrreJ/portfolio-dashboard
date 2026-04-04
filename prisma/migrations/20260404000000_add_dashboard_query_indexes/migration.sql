CREATE INDEX IF NOT EXISTS "Portfolio_userId_createdAt_idx"
ON "Portfolio"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Transaction_portfolioId_date_idx"
ON "Transaction"("portfolioId", "date");

CREATE INDEX IF NOT EXISTS "Transaction_assetId_date_idx"
ON "Transaction"("assetId", "date");
