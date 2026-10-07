-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "bounceCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TaskStageEntry" ADD COLUMN     "isSendBack" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sendBackReason" TEXT;
