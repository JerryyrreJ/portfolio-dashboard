ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "eventId" TEXT,
ADD COLUMN IF NOT EXISTS "source" TEXT,
ADD COLUMN IF NOT EXISTS "subtype" TEXT,
ADD COLUMN IF NOT EXISTS "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Transaction_eventId_idx"
ON "Transaction"("eventId");

CREATE INDEX IF NOT EXISTS "Transaction_source_subtype_idx"
ON "Transaction"("source", "subtype");
