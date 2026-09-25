ALTER TABLE "Post" ADD COLUMN "linkedPostId" TEXT;

ALTER TABLE "Post" ADD CONSTRAINT "Post_linkedPostId_fkey"
  FOREIGN KEY ("linkedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Post_linkedPostId_createdAt_idx" ON "Post"("linkedPostId", "createdAt");
