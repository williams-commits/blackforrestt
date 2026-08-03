import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { releaseBlock } from "@/server/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ note: z.string().trim().min(3).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("RECONCILIATION_MANAGE");
    const { id } = await context.params;
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A release reason is required.", details: parsed.error.flatten() }, { status: 400 });
    const changed = await releaseBlock({ blockId: id, actorId, note: parsed.data.note });
    if (!changed) return NextResponse.json({ error: "Block was not found or is already released." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to release reconciliation block." : error instanceof Error ? error.message : "Unable to release reconciliation block." }, { status });
  }
}
