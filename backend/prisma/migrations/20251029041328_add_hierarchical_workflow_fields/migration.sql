-- CreateEnum
CREATE TYPE "WorkRequestType" AS ENUM ('ACTION_REQUEST', 'SERVICE_CREATE', 'TEAM_CREATE', 'IN_NEGOTIATION');

-- AlterTable
ALTER TABLE "WorkRequest" ADD COLUMN     "requestType" "WorkRequestType" NOT NULL DEFAULT 'ACTION_REQUEST',
ADD COLUMN     "parentWorkRequestId" TEXT,
ADD COLUMN     "targetItemType" "ItemType",
ADD COLUMN     "createdItemId" TEXT;

-- CreateIndex
CREATE INDEX "WorkRequest_parentWorkRequestId_idx" ON "WorkRequest"("parentWorkRequestId");

-- CreateIndex
CREATE INDEX "WorkRequest_requestType_idx" ON "WorkRequest"("requestType");

-- CreateIndex
CREATE INDEX "WorkRequest_createdItemId_idx" ON "WorkRequest"("createdItemId");

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_parentWorkRequestId_fkey" FOREIGN KEY ("parentWorkRequestId") REFERENCES "WorkRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_createdItemId_fkey" FOREIGN KEY ("createdItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
