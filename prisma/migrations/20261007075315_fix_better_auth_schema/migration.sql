/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `providerAccountId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `sessionState` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `tokenType` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Account` table. All the data in the column will be lost.
  - The `accessTokenExpiresAt` column on the `Account` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `refreshTokenExpiresAt` column on the `Account` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `accountId` on table `Account` required. This step will fail if there are existing NULL values in that column.
  - Made the column `providerId` on table `Account` required. This step will fail if there are existing NULL values in that column.

*/
-- Delete any accounts with NULL accountId or providerId to avoid constraint violation
DELETE FROM "Account" WHERE "accountId" IS NULL OR "providerId" IS NULL;

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "expiresAt",
DROP COLUMN "provider",
DROP COLUMN "providerAccountId",
DROP COLUMN "sessionState",
DROP COLUMN "tokenType",
DROP COLUMN "type",
DROP COLUMN "accessTokenExpiresAt",
ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ALTER COLUMN "accountId" SET NOT NULL,
ALTER COLUMN "providerId" SET NOT NULL,
DROP COLUMN "refreshTokenExpiresAt",
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3);
