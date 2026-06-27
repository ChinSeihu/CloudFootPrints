ALTER TABLE "CheckIn" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "eventId" TEXT;

CREATE INDEX "CheckIn_eventId_createdAt_idx" ON "CheckIn"("eventId", "createdAt");
CREATE INDEX "CheckIn_postId_createdAt_idx" ON "CheckIn"("postId", "createdAt");
CREATE INDEX "CheckIn_isPublic_createdAt_idx" ON "CheckIn"("isPublic", "createdAt");
CREATE INDEX "Post_eventId_createdAt_idx" ON "Post"("eventId", "createdAt");

ALTER TABLE "Post" ADD CONSTRAINT "Post_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
