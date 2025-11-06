-- CreateTable
CREATE TABLE "SlackConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "signingSecret" TEXT,
    "appId" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackConfig_name_key" ON "SlackConfig"("name");

-- CreateIndex
CREATE INDEX "SlackConfig_name_idx" ON "SlackConfig"("name");
