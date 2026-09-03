CREATE TYPE "PostKind" AS ENUM ('LIFE', 'ACTIVITY');

ALTER TABLE "Post"
ADD COLUMN "kind" "PostKind" NOT NULL DEFAULT 'ACTIVITY';

UPDATE "Post"
SET
  "kind" = 'LIFE',
  "startTime" = NULL,
  "endTime" = NULL,
  "signupEnabled" = false
WHERE 'social' = ANY("tags");

CREATE INDEX "Post_kind_lat_lng_idx" ON "Post"("kind", "lat", "lng");
