-- AlterTable
ALTER TABLE "User" ADD COLUMN "title" TEXT,
ADD COLUMN "position" TEXT,
ADD COLUMN "departmentNumber" TEXT;

-- v1.1.18: Add title (직위), position (직책), departmentNumber (부서 코드) to User table
-- These fields will be synced from LDAP attributes
