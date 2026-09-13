import test from "node:test";
import { randomUUID } from "node:crypto";

const RUN = randomUUID().slice(0, 8);
const RUN_EMAIL = `inbox.person.${RUN}@example.com`;
const RUN_EMAIL_2 = `scoped.inbox.${RUN}@example.com`;
import assert from "node:assert/strict";
import { prisma, repContext, rep2Context, managerContext } from "./helpers";
import {
  receiveInboundEmail,
  readEmail,
  setEmailRead,
  listMailbox,
  sendRecordEmail,
} from "../src/server/records/emails";

/**
 * Email module: persistence, inbound ingestion + auto-linking, read state,
 * and record-scope visibility. SMTP is not configured in tests, so outbound
 * is exercised through its FAILED path (which must still archive history).
 */

test("outbound send archives history even when SMTP is not configured", async () => {
  const rep = await repContext();
  const defaultStatus = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", isDefault: true } });
  const lead = await prisma.lead.create({
    data: { firstName: "Email", lastName: "Outbound", email: "email.outbound@example.com", assignedUserId: rep.userId, statusId: defaultStatus.id },
  });
  const before = await prisma.emailMessage.count();

  await assertThrows(
    () => sendRecordEmail(rep, {
      to: "customer@example.com",
      subject: "Testing outbound archive",
      body: "Hello — this send should be archived.",
      subjectType: "LEAD",
      subjectId: lead.id,
    }),
    503,
    "SMTP not configured throws",
  );

  const stored = await prisma.emailMessage.findFirst({
    where: { direction: "OUTBOUND", subject: "Testing outbound archive" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(stored, "failed send persisted to email history");
  assert.equal(stored.status, "FAILED");
  assert.equal(stored.error, "SMTP not configured");
  assert.equal(stored.subjectId, lead.id);
  assert.equal(stored.threadKey, `LEAD:${lead.id}`);
  assert.ok(stored.readAt, "own sends are never unread");

  // Record history lists it (folder-agnostic subject query).
  const history = await listMailbox(rep, { folder: "all", unread: false, page: 1, subjectType: "LEAD", subjectId: lead.id });
  assert.ok(history.rows.some((row) => row.id === stored.id), "record history includes the archived send");

  await prisma.emailMessage.delete({ where: { id: stored.id } });
  await prisma.activityEvent.deleteMany({ where: { subjectType: "LEAD", subjectId: lead.id, kind: "email_failed" } });
  await prisma.lead.delete({ where: { id: lead.id } });
  void before;
});

test("inbound email auto-links by sender address and lands unread in the inbox", async () => {
  const MESSAGE_ID = `<test-inbound-${RUN}@provider>`;
  const rep = await repContext();
  const contact = await prisma.contact.create({
    data: { firstName: "Inbox", lastName: "Person", email: RUN_EMAIL, ownerUserId: rep.userId },
  });

  const received = await receiveInboundEmail({
    from: RUN_EMAIL,
    to: "support@crm.local",
    subject: "Re: Pricing question",
    text: "Thanks — what are your rates for the annual plan?",
    messageId: MESSAGE_ID,
  });
  assert.equal(received.deduplicated, false);
  assert.deepEqual(received.linkedTo, { subjectType: "CONTACT", subjectId: contact.id });

  // Webhook redelivery with the same Message-ID is a no-op.
  const again = await receiveInboundEmail({
    from: RUN_EMAIL,
    to: "support@crm.local",
    subject: "Re: Pricing question",
    text: "Thanks — what are your rates for the annual plan?",
    messageId: MESSAGE_ID,
  });
  assert.equal(again.deduplicated, true, "message-id dedup");
  assert.equal(again.id, received.id);

  // Unread in the inbox for a scoped reader.
  const inbox = await listMailbox(rep, { folder: "inbox", unread: false, page: 1 });
  const row = inbox.rows.find((entry) => entry.id === received.id);
  assert.ok(row, "inbound mail in inbox");
  assert.equal(row!.read, false, "starts unread");
  assert.equal(inbox.unreadCount > 0, true);

  // Reading marks it read.
  const opened = await readEmail(rep, received.id);
  assert.equal(opened.read, true);
  assert.equal(opened.body.includes("annual plan"), true);

  // Mark unread again works.
  const unread = await setEmailRead(rep, received.id, false);
  assert.equal(unread.read, false);

  // The linked record's timeline got an email_received event.
  const activity = await prisma.activityEvent.findFirst({
    where: { subjectType: "CONTACT", subjectId: contact.id, kind: "email_received" },
  });
  assert.ok(activity, "timeline event recorded");

  // Cleanup
  await prisma.activityEvent.deleteMany({ where: { subjectType: "CONTACT", subjectId: contact.id, kind: "email_received" } });
  await prisma.emailMessage.delete({ where: { id: received.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
});

test("mailbox hides record-linked emails outside the reader's scope", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const contact = await prisma.contact.create({
    data: { firstName: "Scoped", lastName: "Inbox", email: RUN_EMAIL_2, ownerUserId: rep.userId },
  });

  const received = await receiveInboundEmail({
    from: RUN_EMAIL_2,
    to: "support@crm.local",
    subject: "Scope check",
    text: "Only the owner's team should see me.",
    messageId: `<test-scope-a-${randomUUID()}@provider>`,
  });

  // Owner sees it; another OWN-scope rep does not.
  const forOwner = await listMailbox(rep, { folder: "inbox", unread: false, page: 1 });
  assert.ok(forOwner.rows.some((row) => row.id === received.id), "owner sees linked mail");
  const forRep2 = await listMailbox(rep2, { folder: "inbox", unread: false, page: 1 });
  assert.equal(forRep2.rows.some((row) => row.id === received.id), false, "out-of-scope rep does not");

  // Direct read is also denied.
  await assertThrows(() => readEmail(rep2, received.id), 404, "scope-checked read");

  // Unlinked inbound mail is visible to every EMAILS_VIEW holder (shared inbox).
  const unlinked = await receiveInboundEmail({
    from: "stranger@example.com",
    to: "support@crm.local",
    subject: "Unlinked note",
    text: "No matching record.",
    messageId: `<test-scope-b-${randomUUID()}@provider>`,
  });
  const forRep2Again = await listMailbox(rep2, { folder: "inbox", unread: false, page: 1 });
  assert.ok(forRep2Again.rows.some((row) => row.id === unlinked.id), "shared inbox visible without scope");

  await prisma.emailMessage.deleteMany({ where: { id: { in: [received.id, unlinked.id] } } });
  await prisma.contact.delete({ where: { id: contact.id } });
});

test("sending requires EMAILS_SEND independently of record Edit", async () => {
  const rep = await repContext();
  const defaultStatus = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", isDefault: true } });
  const lead = await prisma.lead.create({
    data: { firstName: "Perm", lastName: "Send", assignedUserId: rep.userId, statusId: defaultStatus.id },
  });

  // VIEW alone (even with EDIT) cannot send when EMAILS_SEND is off.
  const withoutSend = { ...rep, permissions: rep.permissions.filter((p) => p !== "EMAILS_SEND") };
  await assertThrows(
    () => sendRecordEmail(withoutSend, { to: "x@example.com", subject: "No", body: "x", subjectType: "LEAD", subjectId: lead.id }),
    403,
    "no EMAILS_SEND",
  );

  // EMAILS_SEND without EDIT is sufficient (module owns its capability).
  const sendOnly = { ...rep, permissions: [...new Set([...rep.permissions.filter((p) => !p.endsWith("_EDIT")), "EMAILS_SEND"])] };
  await assertThrows(
    () => sendRecordEmail(sendOnly, { to: "x@example.com", subject: "Yes", body: "x", subjectType: "LEAD", subjectId: lead.id }),
    503,
    "SMTP-not-configured reached — permission passed",
  );

  // Mailbox requires EMAILS_VIEW.
  const withoutView = { ...rep, permissions: rep.permissions.filter((p) => p !== "EMAILS_VIEW") };
  await assertThrows(() => listMailbox(withoutView, { folder: "inbox", unread: false, page: 1 }), 403, "no EMAILS_VIEW");
  const manager = await managerContext();
  await listMailbox(manager, { folder: "inbox", unread: false, page: 1 });

  // Cleanup the archived failed send from the sendOnly attempt
  await prisma.emailMessage.deleteMany({ where: { subject: "Yes", subjectId: lead.id } });
  await prisma.activityEvent.deleteMany({ where: { subjectType: "LEAD", subjectId: lead.id, kind: "email_failed" } });
  await prisma.lead.delete({ where: { id: lead.id } });
});

async function assertThrows(fn: () => Promise<unknown>, status: number, label: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const e = error as { status?: number; message?: string; name?: string };
    if (e.status !== status && !(e.name === "CrmError" && e.message)) {
      throw new Error(`${label}: expected ${status}, got ${e.status} (${e.message})`);
    }
    if (e.status !== undefined && e.status !== status) {
      throw new Error(`${label}: expected ${status}, got ${e.status} (${e.message})`);
    }
    return;
  }
  throw new Error(`${label}: expected error ${status}, got success`);
}
