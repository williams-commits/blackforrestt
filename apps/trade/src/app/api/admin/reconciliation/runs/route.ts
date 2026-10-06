import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["RUNNING", "COMPLETED", "FAILED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export async function GET(request: Request) {
  try {
    await requireAdmin("RECONCILIATION_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({ status: params.get("status") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid query." }, { status: 400 });

    const runs = await prisma.reconciliationRun.findMany({
      where: { status: parsed.data.status },
      orderBy: { startedAt: "desc" },
      take: parsed.data.limit,
    });
    return NextResponse.json({
      runs: runs.map((run) => ({
        id: run.id,
        reference: run.reference,
        trigger: run.trigger,
        status: run.status,
        windowStart: run.windowStart?.toISOString() ?? null,
        windowEnd: run.windowEnd?.toISOString() ?? null,
        requestedBy: run.requestedBy,
        startedAt: run.startedAt.toISOString(),
        heartbeatAt: run.heartbeatAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        usersChecked: run.usersChecked,
        caseCount: run.caseCount,
        blockCount: run.blockCount,
        summary: run.summary,
        errorMessage: run.errorMessage,
      })),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to list reconciliation runs." : error instanceof Error ? error.message : "Unable to list reconciliation runs." }, { status });
  }
}
