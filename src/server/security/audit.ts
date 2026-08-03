import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { appendAuditEvent } from "../ledger";

export async function appendSecurityAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.$transaction(
    (tx) => appendAuditEvent(tx, input),
    { isolationLevel: "Serializable" },
  );
}
