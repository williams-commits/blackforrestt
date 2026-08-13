import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import { adjustUserBalance } from "@/server/adminBalance";
import { hub } from "@/server/engine/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["CREDIT", "DEBIT"]),
  amount: z.number().positive().max(1_000_000),
  reason: z.string().min(5).max(500),
});

/** POST /api/admin/groups/[id]/balance — bulk balance adjustment for all members. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_BALANCE_ADJUST");
    const { id: groupId } = await params;
    const body = schema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const group = await prisma.userGroup.findUnique({
      where: { id: groupId },
      select: { name: true, members: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const results: Array<{ userId: string; ok: boolean; error?: string }> = [];
    const commandKey = `group-balance-${groupId}-${body.data.action}-${Date.now()}`;

    for (const member of group.members) {
      try {
        await adjustUserBalance({
          userId: member.userId,
          action: body.data.action,
          amount: body.data.amount.toString(),
          reason: `[${group.name}] ${body.data.reason}`,
          commandKey: `${commandKey}-${member.userId}`,
          actorId,
        });
        await hub.publishAccountMetrics(member.userId);
        results.push({ userId: member.userId, ok: true });
      } catch (e) {
        results.push({ userId: member.userId, ok: false, error: e instanceof Error ? e.message : "Failed" });
      }
    }

    await prisma.$transaction(async (tx) => {
      await appendAuditEvent(tx, {
        actorId,
        action: "USER_GROUP_BALANCE_ADJUSTED",
        entityType: "UserGroup",
        entityId: groupId,
        metadata: {
          groupName: group.name,
          action: body.data.action,
          amount: body.data.amount,
          reason: body.data.reason,
          successCount: results.filter((r) => r.ok).length,
          failureCount: results.filter((r) => !r.ok).length,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      totalMembers: group.members.length,
      successCount: results.filter((r) => r.ok).length,
      failureCount: results.filter((r) => !r.ok).length,
      failures: results.filter((r) => !r.ok),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to process bulk adjustment." : (error as Error).message }, { status });
  }
}
