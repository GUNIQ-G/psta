-- AlterTable
-- Add hierarchy fields to Team model for LDAP hierarchical structure support

-- 1. Add new columns (nullable first for existing data)
ALTER TABLE "Team" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Team" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Team" ADD COLUMN "ldapType" TEXT;

-- 2. Add foreign key constraint for hierarchical relationship
ALTER TABLE "Team" ADD CONSTRAINT "Team_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Create index for parent lookup performance
CREATE INDEX "Team_parentId_idx" ON "Team"("parentId");

-- Note: Existing teams will have level=0 and ldapType=NULL (manually created teams)
