-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_reporterId_fkey";

-- AlterTable
ALTER TABLE "Attachment" ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "reporterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
