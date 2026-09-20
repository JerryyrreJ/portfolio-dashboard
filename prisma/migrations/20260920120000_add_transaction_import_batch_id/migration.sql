-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_importBatchId_idx" ON "Transaction"("importBatchId");
