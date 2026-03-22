-- CreateTable
CREATE TABLE "PendingDividend" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "exDate" DATE NOT NULL,
    "payDate" DATE,
    "sharesHeld" DOUBLE PRECISION NOT NULL,
    "dividendPerShare" DOUBLE PRECISION NOT NULL,
    "calculatedAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingDividend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingDividend_portfolioId_status_idx" ON "PendingDividend"("portfolioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PendingDividend_portfolioId_ticker_exDate_key" ON "PendingDividend"("portfolioId", "ticker", "exDate");
