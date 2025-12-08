-- Add soft delete fields to Item table
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Add soft delete fields to WorkRequest table
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Add soft delete fields to Comment table
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Add soft delete fields to File table
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Add soft delete fields to Link table
ALTER TABLE "Link" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Link" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Link" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Create indexes for soft delete fields
CREATE INDEX IF NOT EXISTS "Item_isDeleted_idx" ON "Item"("isDeleted");
CREATE INDEX IF NOT EXISTS "Item_deletedById_idx" ON "Item"("deletedById");

CREATE INDEX IF NOT EXISTS "WorkRequest_isDeleted_idx" ON "WorkRequest"("isDeleted");
CREATE INDEX IF NOT EXISTS "WorkRequest_deletedById_idx" ON "WorkRequest"("deletedById");

CREATE INDEX IF NOT EXISTS "Comment_isDeleted_idx" ON "Comment"("isDeleted");
CREATE INDEX IF NOT EXISTS "Comment_deletedById_idx" ON "Comment"("deletedById");

CREATE INDEX IF NOT EXISTS "File_isDeleted_idx" ON "File"("isDeleted");
CREATE INDEX IF NOT EXISTS "File_deletedById_idx" ON "File"("deletedById");

CREATE INDEX IF NOT EXISTS "Link_isDeleted_idx" ON "Link"("isDeleted");
CREATE INDEX IF NOT EXISTS "Link_deletedById_idx" ON "Link"("deletedById");

-- Add foreign key constraints for deletedById
ALTER TABLE "Item" ADD CONSTRAINT "Item_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "File" ADD CONSTRAINT "File_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Link" ADD CONSTRAINT "Link_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Change CASCADE to SET NULL for Item parent relationship (safely)
-- First, we need to drop the existing constraint and recreate it
ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_parentId_fkey";
ALTER TABLE "Item" ADD CONSTRAINT "Item_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Change CASCADE to SET NULL for Comment, File, Link item relationships
ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_itemId_fkey";
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "File" DROP CONSTRAINT IF EXISTS "File_itemId_fkey";
ALTER TABLE "File" ADD CONSTRAINT "File_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Link" DROP CONSTRAINT IF EXISTS "Link_itemId_fkey";
ALTER TABLE "Link" ADD CONSTRAINT "Link_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
