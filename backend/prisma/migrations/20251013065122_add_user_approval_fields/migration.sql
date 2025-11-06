-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvalMessage" TEXT,
ADD COLUMN     "approvalRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvalRequestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_isVerified_idx" ON "User"("isVerified");

-- CreateIndex
CREATE INDEX "User_approvalRequested_idx" ON "User"("approvalRequested");
