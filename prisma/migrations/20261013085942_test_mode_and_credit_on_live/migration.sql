-- AlterEnum
ALTER TYPE "EventStatus" ADD VALUE 'TEST';

-- AlterTable
ALTER TABLE "donation" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "creditConsumedAt" TIMESTAMP(3);
