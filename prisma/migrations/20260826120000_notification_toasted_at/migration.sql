-- Toast-acknowledgment timestamp: toasts stop consuming the unread state
-- (readAt stays null until the user opens the Notifications tab).
ALTER TABLE "Notification" ADD COLUMN "toastedAt" TIMESTAMP(3);
