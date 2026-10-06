-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TASK_REMINDER';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "reminderNotifiedAt" TIMESTAMP(3);
