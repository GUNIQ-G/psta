-- CreateEnum
CREATE TYPE "NotificationAppType" AS ENUM ('SLACK', 'TELEGRAM', 'DISCORD', 'LINE', 'KAKAOTALK');

-- CreateTable
CREATE TABLE "NotificationApp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NotificationAppType" NOT NULL,
    "config" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationApp_name_key" ON "NotificationApp"("name");

-- CreateIndex
CREATE INDEX "NotificationApp_name_idx" ON "NotificationApp"("name");

-- CreateIndex
CREATE INDEX "NotificationApp_type_idx" ON "NotificationApp"("type");
