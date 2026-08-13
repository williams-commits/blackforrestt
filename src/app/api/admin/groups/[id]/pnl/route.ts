import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import { hub } from "@/server/engine/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  targetProfit: z.number().min(-1_000_000).max(1_000_000),
  reason: z.string().min(5).max(500),
});

/** POST /api/admin/groups/[id]/pnl — bulk P/L targeting for all group open positions. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("EXECUTION_MANAGE");
    const { id: groupId } = await params;
    const body = schema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const group = await prisma.userGroup.findUnique({
      where: { id: groupId },
      select: { name: true, members: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    let totalAdjusted = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (const member of group.members) {
      try {
        // Get all open positions for this user from the hub.
        const positions = hub.listOpenPositions(member.userId);
        for (const pos of positions) {
          try {
            await hub.adminAdjustPositionPnl({
              positionId: pos.id,
              targetProfit: body.data.targetProfit,
              reason: `[${group.name}] ${body.data.reason}`,
              actorId,
            });
            totalAdjusted++;
          } catch {
            totalFailed++;
          }
        }
      } catch {
        totalFailed++;
        errors.push(`Failed for user ${member.userId}`);
      }
    }

    await prisma.$transaction(async (tx) => {
      await appendAuditEvent(tx, {
        actorId,
        action: "USER_GROUP_PNL_ADJUSTED",
        entityType: "UserGroup",
        entityId: groupId,
        metadata: {
          groupName: group.name,
          targetProfit: body.data.targetProfit,
          reason: body.data.reason,
          positionsAdjusted: totalAdjusted,
          positionsFailed: totalFailed,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      positionsAdjusted: totalAdjusted,
      positionsFailed: totalFailed,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to process bulk P/L adjustment." : (error as Error).message }, { status });
  }
}
