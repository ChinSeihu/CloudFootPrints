-- Keep official events when address geocoding fails; map queries exclude these rows.
ALTER TABLE "Event"
  ALTER COLUMN "lat" DROP NOT NULL,
  ALTER COLUMN "lng" DROP NOT NULL;
