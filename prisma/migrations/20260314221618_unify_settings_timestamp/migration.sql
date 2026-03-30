-- AlterTable: Unify settings timestamp fields
-- This migration consolidates nameUpdatedAt, currencyUpdatedAt, and preferencesUpdatedAt
-- into a single settingsUpdatedAt field for simplified local-first sync

-- Add the new unified timestamp field
ALTER TABLE "Portfolio" ADD COLUMN "settingsUpdatedAt" TIMESTAMP(3);

-- Migrate existing data: use the most recent timestamp from the three fields
UPDATE "Portfolio"
SET "settingsUpdatedAt" = GREATEST(
  COALESCE("nameUpdatedAt", '1970-01-01'::timestamp),
  COALESCE("currencyUpdatedAt", '1970-01-01'::timestamp)
);

-- Drop the old individual timestamp fields
ALTER TABLE "Portfolio" DROP COLUMN IF EXISTS "nameUpdatedAt";
ALTER TABLE "Portfolio" DROP COLUMN IF EXISTS "currencyUpdatedAt";
ALTER TABLE "Portfolio" DROP COLUMN IF EXISTS "preferencesUpdatedAt";
