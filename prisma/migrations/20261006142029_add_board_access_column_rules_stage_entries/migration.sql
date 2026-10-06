-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "isOpen" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BoardAccess" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnRule" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColumnRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStageEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredById" TEXT NOT NULL,
    "leftAt" TIMESTAMP(3),
    "leftById" TEXT,
    "durationSeconds" INTEGER,
    "assigneeAtEntry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardAccess_boardId_idx" ON "BoardAccess"("boardId");

-- CreateIndex
CREATE INDEX "BoardAccess_userId_idx" ON "BoardAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardAccess_boardId_userId_key" ON "BoardAccess"("boardId", "userId");

-- CreateIndex
CREATE INDEX "ColumnRule_columnId_idx" ON "ColumnRule"("columnId");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnRule_columnId_ruleType_roleId_key" ON "ColumnRule"("columnId", "ruleType", "roleId");

-- CreateIndex
CREATE INDEX "TaskStageEntry_taskId_idx" ON "TaskStageEntry"("taskId");

-- CreateIndex
CREATE INDEX "TaskStageEntry_columnId_idx" ON "TaskStageEntry"("columnId");

-- AddForeignKey
ALTER TABLE "BoardAccess" ADD CONSTRAINT "BoardAccess_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAccess" ADD CONSTRAINT "BoardAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnRule" ADD CONSTRAINT "ColumnRule_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStageEntry" ADD CONSTRAINT "TaskStageEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStageEntry" ADD CONSTRAINT "TaskStageEntry_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStageEntry" ADD CONSTRAINT "TaskStageEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStageEntry" ADD CONSTRAINT "TaskStageEntry_leftById_fkey" FOREIGN KEY ("leftById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
