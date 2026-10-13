-- AlterTable
ALTER TABLE "donation" ADD COLUMN     "deviceHash" TEXT;

-- CreateIndex
CREATE INDEX "donation_eventId_deviceHash_createdAt_idx" ON "donation"("eventId", "deviceHash", "createdAt");
