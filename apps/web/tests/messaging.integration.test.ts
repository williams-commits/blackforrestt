import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  AdminUserManagementError,
  adminGetThread,
  adminMessageThreads,
  countUnreadDirectMessages,
  getUserMessageThread,
  resolveSupportRecipient,
  sendDirectMessage,
} from "../src/server/adminUserManagement.js";

const prisma = new PrismaClient();

test("support messaging: shared inbox, identity-enriched threads, unread state", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 11);
  const [customer, adminA, adminB, stranger] = await Promise.all([
    prisma.user.create({ data: { email: `msg-customer-${suffix}@example.invalid`, accountNo: `u${suffix}`, name: "Msg Customer" } }),
    prisma.user.create({ data: { email: `msg-admin-a-${suffix}@example.invalid`, accountNo: `a${suffix}`, isAdmin: true, name: "Operator A" } }),
    prisma.user.create({ data: { email: `msg-admin-b-${suffix}@example.invalid`, accountNo: `b${suffix}`, isAdmin: true, name: "Operator B" } }),
    prisma.user.create({ data: { email: `msg-stranger-${suffix}@example.invalid`, accountNo: `s${suffix}`, name: "Unrelated Stranger" } }),
  ]);

  try {
    // Operator-to-operator messaging is rejected outright.
    await assert.rejects(
      sendDirectMessage({ senderId: adminA.id, recipientId: adminB.id, body: "internal chatter", notify: false }),
      (error: unknown) => error instanceof AdminUserManagementError,
    );

    // Customer opens the thread; message routes via resolveSupportRecipient.
    const firstRecipient = await resolveSupportRecipient(customer.id);
    assert.ok(firstRecipient, "an admin must be available to receive");
    const first = await sendDirectMessage({ senderId: customer.id, recipientId: firstRecipient, body: "hello support", notify: true });
    assert.equal(first.senderName, "Msg Customer");
    assert.equal(first.senderIsAdmin, false);
    assert.equal(first.readAt, null);

    // Customer→admin notification names the customer, not "support".
    const customerNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: firstRecipient, type: "CUSTOMER_MESSAGE" },
      orderBy: { createdAt: "desc" },
    });
    assert.match(customerNotification.title, /Msg Customer/);

    // A second operator replies; continuity then routes the customer's next
    // message to operator B, the last one who replied.
    await sendDirectMessage({ senderId: adminB.id, recipientId: customer.id, body: "hi, operator B here", notify: true });
    assert.equal(await resolveSupportRecipient(customer.id), adminB.id);

    // Admin→customer notification is user-facing copy.
    const adminNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: customer.id, type: "ADMIN_CHAT" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(adminNotification.title, "New message from support");

    // Stranger's messages never leak into the customer's support thread.
    await sendDirectMessage({ senderId: customer.id, recipientId: stranger.id, body: "off-band", notify: false });

    // Thread overview: unread counts and reply status for the shared inbox.
    const overview = await adminMessageThreads();
    const row = overview.threads.find((thread) => thread.userId === customer.id);
    assert.ok(row, "customer thread must appear in the inbox");
    assert.equal(row.unread, 1, "customer's inbound message is unread until an operator opens the thread");
    assert.equal(row.status, "REPLIED", "last message is from an operator");
    assert.ok(!overview.threads.some((thread) => thread.userId === stranger.id), "non-support threads never surface");

    // User side: admin replies are visible and marked read on fetch.
    const userThread = await getUserMessageThread({ userId: customer.id });
    assert.equal(userThread.messages.filter((m) => m.senderId === customer.id).length, 1);
    assert.equal(userThread.messages.filter((m) => m.senderId === stranger.id).length, 0, "non-admin correspondents are excluded");
    const adminMessage = userThread.messages.find((m) => m.senderId === adminB.id);
    assert.ok(adminMessage);
    assert.equal(adminMessage.senderIsAdmin, true);
    assert.equal(adminMessage.senderName, "Operator B");
    assert.ok(adminMessage.readAt, "fetching the thread marks admin replies read");
    assert.equal(await countUnreadDirectMessages(customer.id), 0);
    const strangerThread = await getUserMessageThread({ userId: stranger.id });
    assert.equal(strangerThread.messages.length, 0, "user-side thread only covers admin correspondence");

    // Operator B opens the thread: identity comes from the server, and the
    // customer's unread message is consumed for the whole team.
    const opened = await adminGetThread({ adminId: adminB.id, userId: customer.id });
    assert.equal(opened.viewerId, adminB.id);
    assert.equal(opened.user.email, customer.email);
    assert.equal(opened.messages.length, 2);
    assert.ok(opened.messages.every((m) => m.senderId !== stranger.id));
    const afterOpen = await adminMessageThreads();
    assert.equal(afterOpen.threads.find((thread) => thread.userId === customer.id)?.unread, 0);
    assert.equal(afterOpen.threads.find((thread) => thread.userId === customer.id)?.status, "REPLIED", "opening reads messages but doesn't change who spoke last");

    // Unknown user is a 404, not a 500.
    await assert.rejects(
      adminGetThread({ adminId: adminB.id, userId: "does-not-exist" }),
      (error: unknown) => error instanceof AdminUserManagementError && error.status === 404,
    );
  } finally {
    // Cascades remove direct messages and notifications with the users.
    await prisma.user.deleteMany({ where: { id: { in: [customer.id, adminA.id, adminB.id, stranger.id] } } });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
