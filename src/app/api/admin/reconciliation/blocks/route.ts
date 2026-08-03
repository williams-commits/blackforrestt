import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  active: z.enum(["true", "false"]).default("true"),
  scope: z.enum(["TRADE", "WITHDRAW"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    await requireAdmin("RECONCILIATION_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({ active: params.get("active") ?? undefined, scope: params.get("scope") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid query." }, { status: 400 });

    const blocks = await prisma.reconciliationBlock.findMany({
      where: {
        scope: parsed.data.scope,
        releasedAt: parsed.data.active === "true" ? null : { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
      include: {
        user: { select: { email: true, name: true, accountNo: true } },
        case: { select: { feedKind: true, severity: true, status: true, message: true } },
      },
    });
    return NextResponse.json({
      blocks: blocks.map((block) => ({
        id: block.id,
        userId: block.userId,
        scope: block.scope,
        reason: block.reason,
        caseId: block.caseId,
        createdAt: block.createdAt.toISOString(),
        releasedAt: block.releasedAt?.toISOString() ?? null,
        releasedBy: block.releasedBy,
        releaseNote: block.releaseNote,
        user: block.user,
        case: block.case,
      })),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to list reconciliation blocks." : error instanceof Error ? error.message : "Unable to list reconciliation blocks." }, { status });
  }
}
