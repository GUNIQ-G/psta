-- AlterTable
-- Add enhanced fields to LdapConfig model for hierarchical structure and UX improvements

-- 1. Add new columns
ALTER TABLE "LdapConfig" ADD COLUMN "rootOu" TEXT DEFAULT 'Organizations';
ALTER TABLE "LdapConfig" ADD COLUMN "description" TEXT;
ALTER TABLE "LdapConfig" ADD COLUMN "lastTestedAt" TIMESTAMP(3);
ALTER TABLE "LdapConfig" ADD COLUMN "lastTestSuccess" BOOLEAN;

-- Note:
-- - rootOu: Root organizational unit for hierarchical LDAP structure (default: "Organizations")
-- - description: User-friendly description of this LDAP configuration
-- - lastTestedAt: Timestamp of last connection test
-- - lastTestSuccess: Result of last connection test (true/false/null)
