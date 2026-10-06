-- Hot-path covering indexes from the Phase 1 performance audit.
--
-- Position(userId, status, closedAt): /api/positions CLOSED history sorts by
--   closedAt per user; the existing (userId, status) index forced a top-N sort
--   over scan.
-- Position(status, closedAt): the admin executions feed filters by status
--   alone and sorts by closedAt/openedAt.
-- SecuritySession(revokedAt, expiresAt): the admin overview counts distinct
--   active users (revokedAt IS NULL AND expiresAt > now) — every existing
--   index leads with userId, so the dashboard query full-scanned.
CREATE INDEX "Position_userId_status_closedAt_idx" ON "Position"("userId", "status", "closedAt");
CREATE INDEX "Position_status_closedAt_idx" ON "Position"("status", "closedAt");
CREATE INDEX "SecuritySession_revokedAt_expiresAt_idx" ON "SecuritySession"("revokedAt", "expiresAt");
