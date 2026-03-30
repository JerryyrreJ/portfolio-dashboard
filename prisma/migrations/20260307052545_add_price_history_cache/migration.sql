-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "historyLastUpdated" TIMESTAMP(3);
ALTER TABLE "Asset" ADD COLUMN "priceHistory" TEXT;
