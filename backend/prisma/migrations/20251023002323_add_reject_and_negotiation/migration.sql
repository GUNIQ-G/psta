-- AlterEnum
ALTER TYPE "WorkRequestStatus" ADD VALUE 'REJECTED';
ALTER TYPE "WorkRequestStatus" ADD VALUE 'IN_NEGOTIATION';

-- AlterTable
ALTER TABLE "WorkRequest" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "WorkRequest" ADD COLUMN "rejectedById" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "rejectionMessage" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "negotiationMessage" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "negotiationAt" TIMESTAMP(3);
ALTER TABLE "WorkRequest" ADD COLUMN "negotiationById" TEXT;
