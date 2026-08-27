import type { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { appendAuditEvent } from "./ledger";
import { hashPassword } from "../auth";
import {
  deliverSecurityEmail,
  developmentEmailPreviewEnabled,
  issueSecurityToken,
  securityEmailProviderConfigured,
} from "./security/tokens";
import { appendSecurityAudit } from "./security/audit";
import { brandApexOrigin } from "../lib/branding";

/**
 * Admin account management: suspend / block / soft-delete users, send direct
 * notifications (single user or broadcast), and the admin↔customer direct
 * message thread. All mutating actions write audit events.
 */

export type AccountStatusAction =
  | "SUSPEND"
  | "UNSUSPEND"
  | "BLOCK"
  | "UNBLOCK"
  | "SOFT_DELETE"
  | "RESTORE";

export class AdminUserManagementError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const STATUS_ACTIONS: ReadonlySet<AccountStatusAction> = new Set([
  "SUSPEND", "UNSUSPEND", "BLOCK", "UNBLOCK", "SOFT_DELETE", "RESTORE",
]);

/** Apply an account-state action. Soft-delete keeps all financial history —
 *  rows are never hard-deleted (ledger projections forbid it). */
export async function setUserAccountStatus(input: {
  actorId: string;
  userId: string;
  action: AccountStatusAction;
  note?: string;
}): Promise<{ state: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "DELETED" }> {
  if (!STATUS_ACTIONS.has(input.action)) {
    throw new AdminUserManagementError("Unsupported account action.");
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new AdminUserManagementError("User not found.", 404);

  const now = new Date();
  let data: { suspendedAt?: Date | null; blockedAt?: Date | null; deletedAt?: Date | null };
  let state: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "DELETED";
  switch (input.action) {
    case "SUSPEND":
      data = { suspendedAt: now };
      state = "SUSPENDED";
      break;
    case "UNSUSPEND":
      data = { suspendedAt: null };
      state = "ACTIVE";
      break;
    case "BLOCK":
      data = { blockedAt: now };
      state = "BLOCKED";
      break;
    case "UNBLOCK":
      data = { blockedAt: null };
      state = "ACTIVE";
      break;
    case "SOFT_DELETE":
      data = { deletedAt: now, suspendedAt: now };
      state = "DELETED";
      break;
    case "RESTORE":
      data = { deletedAt: null, suspendedAt: null, blockedAt: null };
      state = "ACTIVE";
      break;
    default:
      throw new AdminUserManagementError("Unsupported account action.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: input.userId }, data });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: `ACCOUNT_${input.action}`,
      entityType: "User",
      entityId: input.userId,
      metadata: { note: input.note?.slice(0, 500) ?? null, state },
    });
    // Surface the change in the user's in-app notifications (email is
    // independently switchable; this always delivers).
    if (input.action !== "RESTORE" && input.action !== "UNSUSPEND" && input.action !== "UNBLOCK") {
      await tx.notification.create({
        data: {
          userId: input.userId,
          type: "ACCOUNT_STATUS",
          title: `Account ${state.toLowerCase()}`,
          body: input.note?.trim() || `Your account status changed to ${state.toLowerCase()}. Contact support if you believe this is a mistake.`,
          metadata: { state, action: input.action },
        },
      });
    }
  });
  return { state };
}

/** Send an in-app notification to one user (audited). */
export async function adminNotifyUser(input: {
  actorId: string;
  userId: string;
  title: string;
  body: string;
}): Promise<void> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > 120) throw new AdminUserManagementError("Title must be 3–120 characters.");
  if (body.length < 3 || body.length > 2000) throw new AdminUserManagementError("Message must be 3–2000 characters.");
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new AdminUserManagementError("User not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.notification.create({
      data: {
        userId: input.userId,
        type: "ADMIN_MESSAGE",
        title,
        body,
        metadata: { fromAdmin: true },
      },
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "ADMIN_NOTIFICATION_SENT",
      entityType: "User",
      entityId: input.userId,
      metadata: { title: title.slice(0, 240) },
    });
  });
}

/** Email the user a single-use password-reset link (admin-triggered recovery).
 *  The admin never sees or sets the password — the user completes the reset
 *  through the standard /reset-password flow, which revokes every active
 *  session and clears any login lockout. Issuing the link invalidates any
 *  previous unconsumed reset token for the account. */
export async function adminSendPasswordReset(input: {
  actorId: string;
  userId: string;
}): Promise<{ sent: boolean; previewUrl?: string; expiresAt: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, emailVerifiedAt: true, deletedAt: true, brandDomain: true },
  });
  if (!user) throw new AdminUserManagementError("User not found.", 404);
  if (user.deletedAt) throw new AdminUserManagementError("Deleted accounts cannot receive password resets.", 409);
  if (!user.email || !user.emailVerifiedAt) {
    throw new AdminUserManagementError("This account has no verified email — the user must verify their email before a reset link can be sent.", 409);
  }

  const providerConfigured = securityEmailProviderConfigured();
  if (!providerConfigured && !developmentEmailPreviewEnabled()) {
    throw new AdminUserManagementError("Email delivery is not configured.", 503);
  }

  const issued = await issueSecurityToken({ userId: input.userId, type: "PASSWORD_RESET" });
  const url = new URL("/reset-password", brandApexOrigin(user.brandDomain ?? undefined));
  url.searchParams.set("token", issued.token);

  // Attribute the trigger to the admin (token issuance itself is audited
  // under the user's identity by issueSecurityToken).
  await appendSecurityAudit({
    actorId: input.actorId,
    action: "PASSWORD_RESET_ADMIN_TRIGGERED",
    entityType: "User",
    entityId: input.userId,
    metadata: { securityTokenId: issued.record.id, expiresAt: issued.expiresAt.toISOString() },
  });

  if (!providerConfigured) {
    // Development preview mode — no provider, so return the raw single-use
    // link for safe out-of-band handover instead of emailing it.
    return { sent: false, previewUrl: url.toString(), expiresAt: issued.expiresAt };
  }

  try {
    await deliverSecurityEmail({
      to: user.email,
      template: "password-reset",
      actionUrl: url.toString(),
      expiresAt: issued.expiresAt,
      userId: input.userId,
      idempotencyKey: `security-token-${issued.record.id}`,
    });
  } catch (error) {
    console.error("Admin-triggered password reset email delivery failed", error);
    throw new AdminUserManagementError("The reset link was issued but the email could not be delivered. Try again, or ask the user to use self-service recovery.", 503);
  }
  return { sent: true, expiresAt: issued.expiresAt };
}

const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TEMPORARY_PASSWORD_LENGTH = 6;

/** Crypto-random alphanumeric temporary password (e.g. "fK7q2m"). */
function generateTemporaryPassword(): string {
  let code = "";
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) {
    code += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  }
  return code;
}

/** Set a random 6-character alphanumeric temporary password for the user
 *  (admin-triggered, e.g. phone support). Every active session is revoked and
 *  any login lockout is cleared, so the user can sign in with the new
 *  password immediately. The code is returned exactly ONCE — it is never
 *  logged, audited, or emailed; the operator delivers it out-of-band. */
export async function adminSetTemporaryPassword(input: {
  actorId: string;
  userId: string;
}): Promise<{ temporaryPassword: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { deletedAt: true },
  });
  if (!user) throw new AdminUserManagementError("User not found.", 404);
  if (user.deletedAt) throw new AdminUserManagementError("Deleted accounts cannot receive a temporary password.", 409);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const changedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { passwordHash, passwordChangedAt: changedAt, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.securitySession.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: changedAt },
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "TEMPORARY_PASSWORD_SET",
      entityType: "User",
      entityId: input.userId,
      // Deliberately records no password material — only the side effects.
      metadata: { sessionsRevoked: true, lockoutCleared: true },
    });
  }, { isolationLevel: "Serializable" });
  return { temporaryPassword };
}

/** Force sign-out: revoke every ACTIVE security session for a user (audited).
 *  Existing JWTs stop validating on their next request (the jwt callback
 *  checks session liveness), and open WebSockets drop on their next
 *  subscribe/heartbeat validation. The user simply signs in again. */
export async function adminRevokeSessions(input: { actorId: string; userId: string }): Promise<{ revoked: number }> {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new AdminUserManagementError("User not found.", 404);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const revoked = await tx.securitySession.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "SESSIONS_REVOKED",
      entityType: "User",
      entityId: input.userId,
      metadata: { count: revoked.count, reason: "ADMIN_FORCE_SIGN_OUT" },
    });
    return { revoked: revoked.count };
  });
}

/** Broadcast an in-app notification to every active (non-deleted) user. */
export async function adminBroadcastNotification(input: {
  actorId: string;
  title: string;
  body: string;
}): Promise<{ recipients: number }> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > 120) throw new AdminUserManagementError("Title must be 3–120 characters.");
  if (body.length < 3 || body.length > 2000) throw new AdminUserManagementError("Message must be 3–2000 characters.");
  const users = await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true } });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: "ADMIN_BROADCAST",
        title,
        body,
        metadata: { broadcast: true, at: now.toISOString() },
      })),
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "ADMIN_NOTIFICATION_BROADCAST",
      entityType: "User",
      entityId: "broadcast",
      metadata: { title: title.slice(0, 240), recipients: users.length },
    });
  });
  return { recipients: users.length };
}

// ── Direct messages (admin ↔ customer chat) ─────────────────────────────────
//
// Threading model: a customer has exactly one shared support thread — every
// DirectMessage between that customer and ANY admin, regardless of which
// operator sent or received it (like a shared support inbox). All read/unread
// and direction logic below derives from sender identity, which is resolved
// server-side and shipped with every message so clients never have to guess.

/** Wire format for a chat message. Sender identity is resolved server-side. */
export interface SupportMessageView {
  id: string;
  senderId: string;
  senderName: string;
  senderIsAdmin: boolean;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const MESSAGE_SELECT = {
  id: true,
  senderId: true,
  recipientId: true,
  body: true,
  readAt: true,
  createdAt: true,
  sender: { select: { name: true, email: true, isAdmin: true, adminRoles: { where: { revokedAt: null }, select: { role: true } } } },
} as const;

/**
 * Canonical "operator" definition — MUST match requireAdminContext: the
 * legacy isAdmin flag OR an active AdminRoleAssignment. A roles-only admin
 * (isAdmin=false) runs the console but was invisible to every isAdmin-only
 * chat query, which broke customer messaging on deployments whose admins
 * were provisioned via roles ("No support operator available").
 */
const OPERATOR_OR = [{ isAdmin: true }, { adminRoles: { some: { revokedAt: null } } }];
/** Any operator, alive or not — for HISTORY queries (old messages stay). */
const OPERATOR_FILTER = { OR: OPERATOR_OR };
/** An operator eligible to receive NEW conversations / count as active. */
const ACTIVE_OPERATOR_FILTER = { OR: OPERATOR_OR, deletedAt: null, suspendedAt: null, blockedAt: null };

function isOperatorRow(user: { isAdmin: boolean; adminRoles: unknown[] }): boolean {
  return user.isAdmin || user.adminRoles.length > 0;
}

type MessageRow = Prisma.DirectMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

function serializeMessage(row: MessageRow): SupportMessageView {
  return {
    id: row.id,
    senderId: row.senderId,
    senderName: row.sender.name ?? row.sender.email ?? "Unknown user",
    senderIsAdmin: isOperatorRow(row.sender),
    recipientId: row.recipientId,
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function displayName(user: { name: string | null; email: string | null }): string {
  return user.name ?? user.email ?? "Unknown user";
}

const MAX_THREAD_LIMIT = 200;
function clampLimit(limit: number | undefined): number {
  return Math.min(MAX_THREAD_LIMIT, Math.max(1, limit ?? 100));
}

/** Customer side: fetch their support thread with the admin team. Marks
 *  admin→customer messages read and reports whether older history exists. */
export async function getUserMessageThread(input: { userId: string; limit?: number; markRead?: boolean }) {
  const limit = clampLimit(input.limit);
  const rows = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: input.userId, recipient: OPERATOR_FILTER },
        { sender: OPERATOR_FILTER, recipientId: input.userId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: MESSAGE_SELECT,
  });
  const hasMore = rows.length > limit;
  const messages = (hasMore ? rows.slice(0, limit) : rows).reverse();
  const unreadIds = messages.filter((m) => m.recipientId === input.userId && isOperatorRow(m.sender) && !m.readAt).map((m) => m.id);
  let readNow: Date | null = null;
  // Read-marking is EXPLICIT (markRead !== false): background polls fetch the
  // thread without consuming the unread state, so the Messages badge survives
  // until the customer actually has the conversation in view.
  if (unreadIds.length > 0 && input.markRead !== false) {
    readNow = new Date();
    await prisma.directMessage.updateMany({ where: { id: { in: unreadIds } }, data: { readAt: readNow } });
  }
  return {
    messages: messages.map((m) => (readNow && unreadIds.includes(m.id) ? { ...m, readAt: m.readAt ?? readNow } : m)).map(serializeMessage),
    hasMore,
  };
}

/** Resolve which admin a customer's outgoing message should be routed to:
 *  the admin who last replied in their thread (conversation continuity), or
 *  the longest-tenured active admin for a fresh thread. Two indexed queries. */
export async function resolveSupportRecipient(userId: string): Promise<string | null> {
  // An admin qualifies to receive customer chat only while ACTIVE — deleted,
  // suspended, or blocked operators must not be routed new conversations.
  const lastAdminReply = await prisma.directMessage.findFirst({
    where: { recipientId: userId, sender: ACTIVE_OPERATOR_FILTER },
    orderBy: { createdAt: "desc" },
    select: { senderId: true },
  });
  if (lastAdminReply) return lastAdminReply.senderId;
  const fallback = await prisma.user.findFirst({
    where: ACTIVE_OPERATOR_FILTER,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

/** Send a direct message and an in-app notification to the recipient.
 *  Returns the serialized message so callers can update without a refetch. */
export async function sendDirectMessage(input: {
  senderId: string;
  recipientId: string;
  body: string;
  notify: boolean;
}): Promise<SupportMessageView> {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 4000) throw new AdminUserManagementError("Message must be 1–4000 characters.");
  const created = await prisma.$transaction(async (tx) => {
    const sender = await tx.user.findUnique({
      where: { id: input.senderId },
      select: { id: true, isAdmin: true, name: true, email: true, adminRoles: { where: { revokedAt: null }, select: { role: true } } },
    });
    if (!sender) throw new AdminUserManagementError("Sender not found.", 404);
    const recipient = await tx.user.findUnique({
      where: { id: input.recipientId },
      select: { id: true, isAdmin: true, name: true, email: true, adminRoles: { where: { revokedAt: null }, select: { role: true } } },
    });
    if (!recipient) throw new AdminUserManagementError("Recipient not found.", 404);
    if (isOperatorRow(sender) && isOperatorRow(recipient)) {
      throw new AdminUserManagementError("Operator-to-operator messages are not supported.");
    }
    const message = await tx.directMessage.create({
      data: { senderId: input.senderId, recipientId: input.recipientId, body },
      select: MESSAGE_SELECT,
    });
    if (input.notify) {
      await tx.notification.create({
        data: isOperatorRow(sender)
          ? {
              userId: input.recipientId,
              type: "ADMIN_CHAT",
              title: "New message from support",
              body: body.slice(0, 240),
              metadata: { chat: true, operatorId: input.senderId },
            }
          : {
              userId: input.recipientId,
              type: "CUSTOMER_MESSAGE",
              title: `New message from ${displayName(sender)}`,
              body: body.slice(0, 240),
              metadata: { chat: true, customerId: input.senderId },
            },
      });
    }
    return message;
  });
  return serializeMessage(created);
}

export interface AdminThreadSummary {
  userId: string;
  email: string | null;
  name: string | null;
  accountNo: string | null;
  /** Brand family the customer signed up under (null = primary). */
  brandDomain: string | null;
  lastMessageAt: string | null;
  lastMessage: string;
  lastFromAdmin: boolean;
  /** Customer messages no operator has opened yet. */
  unread: number;
  /** AWAITING_REPLY = the ball is with support; REPLIED = with the customer. */
  status: "AWAITING_REPLY" | "REPLIED";
}

/** Admin side: thread overview across the shared inbox — latest message,
 *  unread count, and reply status per customer, plus the team's totals. */
export async function adminMessageThreads(): Promise<{ threads: AdminThreadSummary[]; totalUnread: number }> {
  const customers = await prisma.user.findMany({
    where: {
      OR: [
        { sentMessages: { some: { recipient: OPERATOR_FILTER } } },
        { receivedMessages: { some: { sender: OPERATOR_FILTER } } },
      ],
    },
    select: {
      id: true, email: true, name: true, accountNo: true, brandDomain: true,
      // Latest support-thread message on each side — non-admin correspondence
      // (off-band user-to-user messages) never leaks into the shared inbox.
      sentMessages: {
        where: { recipient: OPERATOR_FILTER },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, body: true, senderId: true },
      },
      receivedMessages: {
        where: { sender: OPERATOR_FILTER },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, body: true, senderId: true },
      },
    },
  });
  // One grouped query for unread customer→admin messages across all threads.
  const unreadByCustomer = await prisma.directMessage.groupBy({
    by: ["senderId"],
    where: { readAt: null, sender: { isAdmin: false, adminRoles: { none: { revokedAt: null } } }, recipient: OPERATOR_FILTER },
    _count: { _all: true },
  });
  const unreadMap = new Map(unreadByCustomer.map((row) => [row.senderId, row._count._all]));
  const adminUsers = await prisma.user.findMany({ where: OPERATOR_FILTER, select: { id: true } });
  const adminIds = new Set(adminUsers.map((admin) => admin.id));
  const threads = customers.map((customer): AdminThreadSummary => {
    const latest = [customer.sentMessages[0], customer.receivedMessages[0]]
      .filter(Boolean)
      .sort((a, b) => b!.createdAt.getTime() - a!.createdAt.getTime())[0];
    const lastFromAdmin = latest ? adminIds.has(latest.senderId) : false;
    return {
      userId: customer.id,
      email: customer.email,
      name: customer.name,
      accountNo: customer.accountNo,
      brandDomain: customer.brandDomain,
      lastMessageAt: latest?.createdAt.toISOString() ?? null,
      lastMessage: latest?.body?.slice(0, 120) ?? "",
      lastFromAdmin,
      unread: unreadMap.get(customer.id) ?? 0,
      status: lastFromAdmin ? "REPLIED" : "AWAITING_REPLY",
    };
  }).sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  return { threads, totalUnread: threads.reduce((sum, thread) => sum + thread.unread, 0) };
}

/** Admin side: full shared-inbox thread with one customer, including who the
 *  customer is and the viewing operator's identity. Opening a thread marks the
 *  customer's messages read for the whole team (shared-inbox semantics). */
export async function adminGetThread(input: { adminId: string; userId: string; limit?: number }) {
  const limit = clampLimit(input.limit);
  const [customer, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true, accountNo: true, isAdmin: true },
    }),
    prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: input.userId, recipient: { isAdmin: true } },
          { sender: { isAdmin: true }, recipientId: input.userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: MESSAGE_SELECT,
    }),
  ]);
  if (!customer) throw new AdminUserManagementError("User not found.", 404);
  const hasMore = rows.length > limit;
  const messages = (hasMore ? rows.slice(0, limit) : rows).reverse();
  const unreadIds = messages
    .filter((m) => m.senderId === customer.id && !m.readAt)
    .map((m) => m.id);
  let readNow: Date | null = null;
  if (unreadIds.length > 0) {
    readNow = new Date();
    await prisma.directMessage.updateMany({ where: { id: { in: unreadIds } }, data: { readAt: readNow } });
  }
  return {
    viewerId: input.adminId,
    user: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      accountNo: customer.accountNo,
      isAdmin: customer.isAdmin,
    },
    messages: messages.map((m) => (readNow && unreadIds.includes(m.id) ? { ...m, readAt: m.readAt ?? readNow } : m)).map(serializeMessage),
    hasMore,
  };
}

/** Admin side: permanently remove a customer's entire support thread (a
 *  moderation action). Writes an audit event recording what was removed —
 *  message bodies are deleted, but the action itself stays accountable. */
export async function adminDeleteThread(input: { actorId: string; userId: string }): Promise<{ deleted: number }> {
  const customer = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, isAdmin: true, adminRoles: { where: { revokedAt: null }, select: { role: true } } } });
  if (!customer) throw new AdminUserManagementError("User not found.", 404);
  if (isOperatorRow(customer)) throw new AdminUserManagementError("Operator conversations cannot be deleted.", 400);
  const where = {
    OR: [
      { senderId: input.userId, recipient: OPERATOR_FILTER },
      { sender: OPERATOR_FILTER, recipientId: input.userId },
    ],
  };
  return prisma.$transaction(async (tx) => {
    const removed = await tx.directMessage.deleteMany({ where });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "ADMIN_CHAT_THREAD_DELETED",
      entityType: "User",
      entityId: input.userId,
      metadata: { deletedMessages: removed.count },
    });
    return { deleted: removed.count };
  });
}

export async function countUnreadDirectMessages(userId: string): Promise<number> {
  return prisma.directMessage.count({
    where: { recipientId: userId, sender: OPERATOR_FILTER, readAt: null },
  });
}
