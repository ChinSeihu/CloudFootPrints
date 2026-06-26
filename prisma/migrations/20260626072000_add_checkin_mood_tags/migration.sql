ALTER TABLE "CheckIn" ADD COLUMN "moodTags" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

UPDATE "CheckIn"
SET "moodTags" = ARRAY["rating"]::INTEGER[]
WHERE "rating" IS NOT NULL
  AND COALESCE(array_length("moodTags", 1), 0) = 0;
