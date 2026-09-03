import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { countAudit, listAudit } from "@/server/records/audit";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Append-only audit trail (AUDIT_VIEW permission). */
export async function GET(request: Request) {
  try {
    await requirePermission("AUDIT_VIEW");
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 25) || 25));
    const [entries, total] = await Promise.all([listAudit(page, pageSize), countAudit()]);
    return NextResponse.json({
      data: entries,
      meta: { page, pageSize, total },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load audit log.");
  }
}
