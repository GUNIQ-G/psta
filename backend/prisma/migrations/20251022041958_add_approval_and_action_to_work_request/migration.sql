-- AlterTable
ALTER TABLE "WorkRequest" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkRequest" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "WorkRequest" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "actionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkRequest_actionId_key" ON "WorkRequest"("actionId");

-- CreateIndex
CREATE INDEX "WorkRequest_approvedById_idx" ON "WorkRequest"("approvedById");

-- CreateIndex
CREATE INDEX "WorkRequest_actionId_idx" ON "WorkRequest"("actionId");

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
