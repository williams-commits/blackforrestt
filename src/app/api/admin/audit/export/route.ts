import type { AuditDomain } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { auditEventsToCsv, auditEventsToNdjson, listAuditEvents } from "@/server/audit";
import { withSerializableRetry } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  format: z.enum(["csv", "ndjson"]).default("csv"),
  domain: z.enum(["SECURITY", "KYC", "PAYMENT", "LEDGER", "EXECUTION", "RECONCILIATION", "CONFIGURATION", "SUPPORT", "ADMIN", "SYSTEM"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

export async function GET(request: Request) {
  try {
    const actorId = await requireAdmin("AUDIT_EXPORT");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({ format: params.get("format") ?? undefined, domain: params.get("domain") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid audit export query." }, { status: 400 });
    const events = await listAuditEvents({ domain: parsed.data.domain as AuditDomain | undefined, limit: parsed.data.limit });
    const body = parsed.data.format === "csv" ? auditEventsToCsv(events) : auditEventsToNdjson(events);
    await withSerializableRetry((tx) => appendAuditEvent(tx, {
      domain: "ADMIN",
      actorId,
      action: "AUDIT_EXPORT_CREATED",
      entityType: "AuditEvent",
      metadata: { format: parsed.data.format, domain: parsed.data.domain ?? "ALL", eventCount: events.length, redacted: true },
    }));
    const stamp = new Date().toISOString().replaceAll(":", "-");
    return new NextResponse(body, {
      headers: {
        "content-type": parsed.data.format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8",
        "content-disposition": `attachment; filename="audit-${stamp}.${parsed.data.format}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to export audit events." : (error as Error).message }, { status });
  }
}
