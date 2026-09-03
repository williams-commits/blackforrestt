import { prisma } from "@/server/db";

/** Audit trail reader (ADMIN/AUDITOR-equivalent permission). */
export function listAudit(page: number, pageSize: number) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { actor: { select: { name: true } } },
  });
}

export async function countAudit(): Promise<number> {
  return prisma.auditLog.count();
}
