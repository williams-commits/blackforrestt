-- Task lifecycle notifications for owners.
ALTER TYPE "NotificationType" ADD VALUE 'TASK_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_CANCELLED';
