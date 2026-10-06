-- Add isOpen field to Board
ALTER TABLE "Board" ADD COLUMN "isOpen" BOOLEAN NOT NULL DEFAULT true;

-- Create BoardAccess table
CREATE TABLE "BoardAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "userId" TEXT,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardAccess_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE,
    CONSTRAINT "BoardAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "BoardAccess_boardId_userId_key" ON "BoardAccess"("boardId", "userId");
CREATE INDEX "BoardAccess_boardId_idx" ON "BoardAccess"("boardId");
CREATE INDEX "BoardAccess_userId_idx" ON "BoardAccess"("userId");

-- Create ColumnRule table
CREATE TABLE "ColumnRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "columnId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ColumnRule_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ColumnRule_columnId_ruleType_roleId_key" ON "ColumnRule"("columnId", "ruleType", "roleId");
CREATE INDEX "ColumnRule_columnId_idx" ON "ColumnRule"("columnId");
