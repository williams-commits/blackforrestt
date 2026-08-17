import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { bulkResolveAll } from "@/server/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ note: z.string().trim().min(3).max(1000) });

/** Releases every active reconciliation block and resolves every unresolved
 *  case in one audited command — for clearing large backlogs at once. */
export async function POST(request: Request) {
  try {
    const actorId = await requireAdmin("RECONCILIATION_MANAGE");
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A resolution reason is required.", details: parsed.error.flatten() }, { status: 400 });
    const result = await bulkResolveAll({ actorId, note: parsed.data.note });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Bulk reconciliation resolve failed", error);
    return NextResponse.json(
      { error: status === 500 ? "Unable to bulk-resolve reconciliation items." : error instanceof Error ? error.message : "Unable to bulk-resolve reconciliation items." },
      { status },
    );
  }
}
