import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { acknowledgeCase, resolveCase } from "@/server/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACKNOWLEDGE"), assignee: z.string().trim().min(2).max(120).optional() }),
  z.object({ action: z.literal("RESOLVE"), note: z.string().trim().min(3).max(1000) }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("RECONCILIATION_MANAGE");
    const { id } = await context.params;
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid case command.", details: parsed.error.flatten() }, { status: 400 });

    const changed = parsed.data.action === "ACKNOWLEDGE"
      ? await acknowledgeCase({ caseId: id, actorId, assignee: parsed.data.assignee })
      : await resolveCase({ caseId: id, actorId, note: parsed.data.note });
    if (!changed) return NextResponse.json({ error: "Case was not found or is already resolved." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to update reconciliation case." : error instanceof Error ? error.message : "Unable to update reconciliation case." }, { status });
  }
}
