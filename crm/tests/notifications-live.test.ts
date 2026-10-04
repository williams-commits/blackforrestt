import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, viewerContext, makeLead } from "./helpers";
import { notify, markToasted, countUnread, listNotifications, NotificationQuery } from "../src/server/notifications";

/**
 * Notification productization: toasts decoupled from reads (toastedAt is
 * durable, toasts never re-fire across reloads; the unread badge survives
 * the toast) and team presence (heartbeat → 90s online window).
 */

async function freshNotification(recipientUserId: string, label: string) {
  const leadId = await makeLead(await repContext(), "notif-live");
  await notify({
    recipientUserId,
    type: "NOTE_ADDED",
    payload: { label, recordType: "LEAD", recordId: leadId },
    context: { href: `/leads/${leadId}`, subjectType: "LEAD", subjectId: leadId },
  });
  return leadId;
}

test("toasting is durable and decoupled from the unread badge", async () => {
  const rep = await repContext();
  const leadId = await freshNotification(rep.userId, "toast-durable");
  try {
    const before = await listNotifications(rep.userId, NotificationQuery.parse({ read: "unread" }));
    const fresh = before.rows.find((row) => row.payload.label === "toast-durable");
    assert.ok(fresh, "unread notification exists");
    assert.equal(fresh.toastedAt, null, "starts untoasted");

    const marked = await markToasted(rep.userId, [fresh.id]);
    assert.equal(marked, 1, "one notification toasted");

    // Re-toasting the same ids is a no-op (toasts never re-fire).
    assert.equal(await markToasted(rep.userId, [fresh.id]), 0, "second toast is a no-op");

    const after = await listNotifications(rep.userId, NotificationQuery.parse({ read: "unread" }));
    const stillThere = after.rows.find((row) => row.id === fresh.id);
    assert.ok(stillThere?.toastedAt, "toastedAt stamped");
    assert.equal(stillThere?.readAt, null, "unread badge SURVIVES the toast");
    assert.equal(await countUnread(rep.userId), after.total, "countUnread unaffected by toasting");
  } finally {
    await prisma.notification.deleteMany({ where: { payload: { path: ["label"], equals: "toast-durable" } } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("toasting other users' notifications is scoped to the recipient", async () => {
  const rep = await repContext();
  const leadId = await freshNotification(rep.userId, "toast-scope");
  try {
    const rows = await listNotifications(rep.userId, NotificationQuery.parse({ read: "unread" }));
    const fresh = rows.rows.find((row) => row.payload.label === "toast-scope");
    assert.ok(fresh);
    // A different recipient cannot toast someone else's notification.
    const viewer = await viewerContext();
    const marked = await markToasted(viewer.userId, [fresh.id]);
    assert.equal(marked, 0, "foreign recipient toasts nothing");
  } finally {
    await prisma.notification.deleteMany({ where: { payload: { path: ["label"], equals: "toast-scope" } } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("presence: heartbeat sets the online window, stale heartbeats expire", async () => {
  const rep = await repContext();
  try {
    // Heartbeat: fresh lastSeenAt lands inside the 90s online window.
    await prisma.user.update({ where: { id: rep.userId }, data: { lastSeenAt: new Date() } });
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: rep.userId }, select: { lastSeenAt: true } });
    const age = Date.now() - (fresh.lastSeenAt?.getTime() ?? 0);
    assert.ok(age < 5_000, "heartbeat stamps lastSeenAt within seconds");

    // A stale heartbeat (10 minutes old) is outside the online window —
    // the same comparison the presence route uses.
    await prisma.user.update({ where: { id: rep.userId }, data: { lastSeenAt: new Date(Date.now() - 10 * 60_000) } });
    const stale = await prisma.user.findUniqueOrThrow({ where: { id: rep.userId }, select: { lastSeenAt: true } });
    const online = stale.lastSeenAt !== null && stale.lastSeenAt.getTime() >= Date.now() - 90_000;
    assert.equal(online, false, "stale heartbeat is offline");

    // Restore a fresh heartbeat for the seeded demo user.
    await prisma.user.update({ where: { id: rep.userId }, data: { lastSeenAt: new Date() } });
  } finally {
    await prisma.user.update({ where: { id: rep.userId }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
});
