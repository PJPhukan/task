-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "isPersonal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_isPersonal_idx" ON "Project"("isPersonal");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
