-- Les événements existants ont consommé leur crédit à la création (ancien modèle) :
-- ils ne doivent pas être débités une seconde fois au passage en direct.
UPDATE "event" SET "creditConsumedAt" = "createdAt" WHERE "creditConsumedAt" IS NULL;
