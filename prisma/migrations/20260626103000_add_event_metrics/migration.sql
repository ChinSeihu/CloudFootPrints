CREATE TABLE "EventMetric" (
  "eventId" TEXT NOT NULL,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventMetric_pkey" PRIMARY KEY ("eventId")
);
