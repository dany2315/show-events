-- AlterTable
ALTER TABLE "donation" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "donor_category" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donor_category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "donor_category_eventId_position_idx" ON "donor_category"("eventId", "position");

-- CreateIndex
CREATE INDEX "donation_eventId_categoryId_idx" ON "donation"("eventId", "categoryId");

-- AddForeignKey
ALTER TABLE "donation" ADD CONSTRAINT "donation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "donor_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_category" ADD CONSTRAINT "donor_category_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
