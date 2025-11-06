-- CreateTable
CREATE TABLE "LdapConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 389,
    "protocol" TEXT NOT NULL DEFAULT 'LDAP',
    "bindDn" TEXT NOT NULL,
    "bindPassword" TEXT NOT NULL,
    "searchBase" TEXT NOT NULL,
    "searchFilter" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 30,
    "enableDynamicUserCreation" BOOLEAN NOT NULL DEFAULT true,
    "attributeLoginId" TEXT NOT NULL DEFAULT 'uid',
    "attributeName" TEXT NOT NULL DEFAULT 'cn',
    "attributeSurname" TEXT NOT NULL DEFAULT 'sn',
    "attributeEmail" TEXT NOT NULL DEFAULT 'Email',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LdapConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LdapConfig_name_key" ON "LdapConfig"("name");

-- CreateIndex
CREATE INDEX "LdapConfig_name_idx" ON "LdapConfig"("name");
