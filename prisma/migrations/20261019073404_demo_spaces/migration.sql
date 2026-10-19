-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "demoIpHash" TEXT,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "organization_isDemo_createdAt_idx" ON "organization"("isDemo", "createdAt");

-- CreateIndex
CREATE INDEX "organization_demoIpHash_createdAt_idx" ON "organization"("demoIpHash", "createdAt");
