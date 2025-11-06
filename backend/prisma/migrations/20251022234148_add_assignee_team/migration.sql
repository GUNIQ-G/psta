-- AlterTable
ALTER TABLE "WorkRequest" ADD COLUMN "assigneeTeamId" TEXT;

-- CreateIndex
CREATE INDEX "WorkRequest_assigneeTeamId_idx" ON "WorkRequest"("assigneeTeamId");

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_assigneeTeamId_fkey" FOREIGN KEY ("assigneeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
