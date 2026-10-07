-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "accessTokenExpiresAt" INTEGER,
ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" INTEGER;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "image" TEXT;
