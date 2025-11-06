-- CreateEnum
CREATE TYPE "WorkRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WorkRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "WorkRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "category" TEXT,
    "dueDate" TIMESTAMP(3),
    "requesterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkRequest_requesterId_idx" ON "WorkRequest"("requesterId");

-- CreateIndex
CREATE INDEX "WorkRequest_assigneeId_idx" ON "WorkRequest"("assigneeId");

-- CreateIndex
CREATE INDEX "WorkRequest_status_idx" ON "WorkRequest"("status");

-- CreateIndex
CREATE INDEX "WorkRequest_priority_idx" ON "WorkRequest"("priority");

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
