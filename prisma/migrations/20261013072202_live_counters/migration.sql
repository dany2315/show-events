-- AlterTable
ALTER TABLE "event" ADD COLUMN     "liveCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "liveTotal" INTEGER NOT NULL DEFAULT 0;

-- Initialisation des compteurs à partir des promesses existantes
UPDATE "event" e
SET "liveTotal" = COALESCE(s.total, 0), "liveCount" = COALESCE(s.cnt, 0)
FROM (
  SELECT "eventId", SUM(amount)::int AS total, COUNT(*)::int AS cnt
  FROM "donation" WHERE "deletedAt" IS NULL GROUP BY "eventId"
) s
WHERE s."eventId" = e.id;
