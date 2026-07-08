-- Add comments and reactions to public check-ins.
ALTER TABLE "Comment" ADD COLUMN "checkInId" TEXT;
ALTER TABLE "Reaction" ADD COLUMN "checkInId" TEXT;

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_checkInId_fkey"
  FOREIGN KEY ("checkInId") REFERENCES "CheckIn"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reaction"
  ADD CONSTRAINT "Reaction_checkInId_fkey"
  FOREIGN KEY ("checkInId") REFERENCES "CheckIn"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Comment_checkInId_createdAt_idx" ON "Comment"("checkInId", "createdAt");
CREATE INDEX "Reaction_checkInId_type_idx" ON "Reaction"("checkInId", "type");
CREATE UNIQUE INDEX "Reaction_userId_checkInId_type_key" ON "Reaction"("userId", "checkInId", "type");
