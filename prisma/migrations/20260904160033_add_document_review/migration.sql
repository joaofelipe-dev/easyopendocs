-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "reviewIntervalDays" INTEGER;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewIntervalDays" INTEGER;
