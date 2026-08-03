import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]).optional(),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    await requireAdmin("RECONCILIATION_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({
      status: params.get("status") ?? undefined,
      severity: params.get("severity") ?? undefined,
      limit: params.get("limit") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: "Invalid query." }, { status: 400 });

    const cases = await prisma.reconciliationCase.findMany({
      where: { status: parsed.data.status, severity: parsed.data.severity },
      orderBy: { detectedAt: "desc" },
      take: parsed.data.limit,
      include: {
        run: { select: { reference: true, trigger: true, startedAt: true } },
        blocks: { where: { releasedAt: null }, select: { id: true, scope: true, reason: true, createdAt: true } },
      },
    });
    return NextResponse.json({
      cases: cases.map((item) => ({
        id: item.id,
        runId: item.runId,
        userId: item.userId,
        feedKind: item.feedKind,
        severity: item.severity,
        status: item.status,
        message: item.message,
        expectedValue: item.expectedValue,
        actualValue: item.actualValue,
        ownerAssignee: item.ownerAssignee,
        resolutionNote: item.resolutionNote,
        detectedAt: item.detectedAt.toISOString(),
        acknowledgedAt: item.acknowledgedAt?.toISOString() ?? null,
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
        run: { ...item.run, startedAt: item.run.startedAt.toISOString() },
        blocks: item.blocks.map((block) => ({ ...block, createdAt: block.createdAt.toISOString() })),
      })),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to list reconciliation cases." : error instanceof Error ? error.message : "Unable to list reconciliation cases." }, { status });
  }
}
