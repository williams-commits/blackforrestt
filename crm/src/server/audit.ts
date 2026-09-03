import type { Prisma } from "@prisma/client";

/**
 * Append-only audit writer. Every state-changing operation in the CRM goes
 * through this inside its transaction, mirroring the trading platform's
 * immutable AuditEvent pattern. There is deliberately no update or delete.
 */
export interface AuditEntry {
  actorId?: string | null;
  action: string;
  objectType: string;
  objectId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string | null;
}

type TransactionClient = Prisma.TransactionClient | Pick<Prisma.TransactionClient, "auditLog">;

export async function appendAudit(tx: TransactionClient, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: entry.actorId ?? null,
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId ?? null,
      before: entry.before,
      after: entry.after,
      ip: entry.ip ?? null,
    },
  });
}
