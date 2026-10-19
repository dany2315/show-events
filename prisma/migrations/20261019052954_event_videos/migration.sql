-- CreateTable
CREATE TABLE "event_video" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_video_eventId_position_idx" ON "event_video"("eventId", "position");

-- AddForeignKey
ALTER TABLE "event_video" ADD CONSTRAINT "event_video_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
