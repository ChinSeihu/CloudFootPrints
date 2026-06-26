ALTER TABLE "Event" ADD COLUMN "featuredToday" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Event_featuredToday_startTime_idx" ON "Event"("featuredToday", "startTime");
