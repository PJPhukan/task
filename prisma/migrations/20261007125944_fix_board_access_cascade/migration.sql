-- DropForeignKey
ALTER TABLE "BoardAccess" DROP CONSTRAINT "BoardAccess_userId_fkey";

-- AddForeignKey
ALTER TABLE "BoardAccess" ADD CONSTRAINT "BoardAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
