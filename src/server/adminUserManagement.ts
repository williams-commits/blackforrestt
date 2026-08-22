import { prisma } from "./db";
import { appendAuditEvent } from "./ledger";

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

/** User side: fetch their thread with admins. Marks admin→user messages read. */
export async function getUserMessageThread(input: { userId: string; limit?: number }) {
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));
  const messages = await prisma.directMessage.findMany({
    where: { OR: [{ senderId: input.userId }, { recipientId: input.userId }] },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, senderId: true, recipientId: true, body: true, readAt: true, createdAt: true,
    },
  });
  const unreadIds = messages.filter((m) => m.recipientId === input.userId && !m.readAt).map((m) => m.id);
  if (unreadIds.length > 0) {
    await prisma.directMessage.updateMany({ where: { id: { in: unreadIds } }, data: { readAt: new Date() } });
  }
  return messages.reverse();
}

/** Send a direct message and an in-app notification to the recipient. */
export async function sendDirectMessage(input: {
  senderId: string;
  recipientId: string;
  body: string;
  notify: boolean;
}): Promise<void> {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 4000) throw new AdminUserManagementError("Message must be 1–4000 characters.");
  await prisma.$transaction(async (tx) => {
    const sender = await tx.user.findUnique({ where: { id: input.senderId }, select: { isAdmin: true, name: true } });
    if (!sender) throw new AdminUserManagementError("Sender not found.", 404);
    const recipient = await tx.user.findUnique({ where: { id: input.recipientId }, select: { id: true } });
    if (!recipient) throw new AdminUserManagementError("Recipient not found.", 404);
    await tx.directMessage.create({
      data: { senderId: input.senderId, recipientId: input.recipientId, body },
    });
    if (input.notify) {
      await tx.notification.create({
        data: {
          userId: input.recipientId,
          type: sender.isAdmin ? "ADMIN_CHAT" : "CHAT_REPLY",
          title: sender.isAdmin ? "New message from support" : "New reply from support",
          body: body.slice(0, 240),
          metadata: { chat: true },
        },
      });
    }
  });
}

/** Admin side: thread overview — latest message + unread count per customer. */
export async function adminMessageThreads() {
  const customers = await prisma.user.findMany({
    where: {
      OR: [
        { sentMessages: { some: { recipient: { isAdmin: true } } } },
        { receivedMessages: { some: { sender: { isAdmin: true } } } },
      ],
    },
    select: {
      id: true, email: true, name: true, accountNo: true,
      sentMessages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, body: true, senderId: true } },
      receivedMessages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, body: true, senderId: true } },
    },
  });
  const adminUsers = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  const adminIds = new Set(adminUsers.map((admin) => admin.id));
  const threads = customers.map((customer) => {
    const latest = [customer.sentMessages[0], customer.receivedMessages[0]]
      .filter(Boolean)
      .sort((a, b) => b!.createdAt.getTime() - a!.createdAt.getTime())[0];
    return {
      userId: customer.id,
      email: customer.email,
      name: customer.name,
      accountNo: customer.accountNo,
      lastMessageAt: latest?.createdAt ?? null,
      lastMessage: latest?.body?.slice(0, 120) ?? "",
      lastFromAdmin: latest ? adminIds.has(latest.senderId) : false,
    };
  }).sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
  return threads;
}

/** Admin side: full thread with one customer. Marks admin's unread customer messages read. */
export async function adminGetThread(input: { adminId: string; userId: string; limit?: number }) {
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));
  const adminUsers = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  const adminIds = adminUsers.map((admin) => admin.id);
  const messages = await prisma.directMessage.findMany({
    where: { OR: [{ senderId: input.userId }, { recipientId: input.userId }] },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, senderId: true, recipientId: true, body: true, readAt: true, createdAt: true },
  });
  const unreadIds = messages
    .filter((m) => adminIds.includes(m.recipientId) && !m.readAt)
    .map((m) => m.id);
  if (unreadIds.length > 0) {
    await prisma.directMessage.updateMany({ where: { id: { in: unreadIds } }, data: { readAt: new Date() } });
  }
  return messages.reverse();
}

export async function countUnreadDirectMessages(userId: string): Promise<number> {
  const adminUsers = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  if (adminUsers.length === 0) return 0;
  return prisma.directMessage.count({
    where: { recipientId: userId, senderId: { in: adminUsers.map((a) => a.id) }, readAt: null },
  });
}
