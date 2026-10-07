-- CreateTable
CREATE TABLE "RoleLabel" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleLabel_roleId_key" ON "RoleLabel"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleLabel_displayName_key" ON "RoleLabel"("displayName");

-- CreateIndex
CREATE INDEX "RoleLabel_roleId_idx" ON "RoleLabel"("roleId");
