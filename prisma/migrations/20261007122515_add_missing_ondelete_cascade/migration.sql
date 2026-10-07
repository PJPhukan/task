-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_actorId_fkey";

-- DropForeignKey
ALTER TABLE "Board" DROP CONSTRAINT "Board_createdById_fkey";

-- DropForeignKey
ALTER TABLE "TaskStageEntry" DROP CONSTRAINT "TaskStageEntry_enteredById_fkey";

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStageEntry" ADD CONSTRAINT "TaskStageEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
