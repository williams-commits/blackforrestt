-- New in-app notification types: record status changes, opportunity stage
-- changes, and notes added on owned records.
ALTER TYPE "NotificationType" ADD VALUE 'RECORD_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'STAGE_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'NOTE_ADDED';
