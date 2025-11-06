-- AlterTable
ALTER TABLE "WorkRequest" DROP COLUMN "category";
ALTER TABLE "WorkRequest" ADD COLUMN "projectId" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "teamId" TEXT;

-- CreateIndex
CREATE INDEX "WorkRequest_projectId_idx" ON "WorkRequest"("projectId");

-- CreateIndex
CREATE INDEX "WorkRequest_serviceId_idx" ON "WorkRequest"("serviceId");

-- CreateIndex
CREATE INDEX "WorkRequest_teamId_idx" ON "WorkRequest"("teamId");
