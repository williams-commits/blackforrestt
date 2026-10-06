import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { withSerializableRetry } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Update = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]),
  assignedToId: z.string().trim().min(10).max(64).optional().nullable(),
  resolutionNote: z.string().trim().max(2000).optional().nullable(),
}).superRefine((value, ctx) => {
  if ((value.status === "RESOLVED" || value.status === "CLOSED") && (!value.resolutionNote || value.resolutionNote.length < 3)) {
    ctx.addIssue({ code: "custom", path: ["resolutionNote"], message: "A resolution note is required." });
  }
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("SUPPORT_MANAGE");
    const { id } = await context.params;
    const parsed = Update.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid support update.", details: parsed.error.flatten() }, { status: 400 });
    const changed = await withSerializableRetry(async (tx) => {
      const existing = await tx.supportCase.findUnique({ where: { id } });
      if (!existing) return null;
      if (parsed.data.assignedToId) {
        const assignee = await tx.user.findFirst({
          where: { id: parsed.data.assignedToId, OR: [{ adminRoles: { some: { revokedAt: null } } }, { isAdmin: true }] },
          select: { id: true },
        });
        if (!assignee) throw new AdminError("Support assignee is not an active administrator.", 400);
      }
      const now = new Date();
      const supportCase = await tx.supportCase.update({
        where: { id },
        data: {
          status: parsed.data.status,
          assignedToId: parsed.data.assignedToId === undefined ? existing.assignedToId : parsed.data.assignedToId,
          resolutionNote: parsed.data.resolutionNote === undefined ? existing.resolutionNote : parsed.data.resolutionNote,
          resolvedAt: parsed.data.status === "RESOLVED" ? now : existing.resolvedAt,
          closedAt: parsed.data.status === "CLOSED" ? now : existing.closedAt,
        },
      });
      await appendAuditEvent(tx, { domain: "SUPPORT", actorId, action: "SUPPORT_CASE_UPDATED", entityType: "SupportCase", entityId: id, metadata: { fromStatus: existing.status, toStatus: supportCase.status, assignedToId: supportCase.assignedToId } });
      return supportCase;
    });
    if (!changed) return NextResponse.json({ error: "Support case not found." }, { status: 404 });
    return NextResponse.json({ case: changed });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to update support case." : (error as Error).message }, { status });
  }
}
