import type { AuditDomain } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { listAuditEvents } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  domain: z.enum(["SECURITY", "KYC", "PAYMENT", "LEDGER", "EXECUTION", "RECONCILIATION", "CONFIGURATION", "SUPPORT", "ADMIN", "SYSTEM"]).optional(),
  actorId: z.string().trim().max(64).optional(),
  entityType: z.string().trim().max(120).optional(),
  entityId: z.string().trim().max(120).optional(),
  action: z.string().trim().max(120).optional(),
  beforeSequence: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function GET(request: Request) {
  try {
    await requireAdmin("AUDIT_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({
      domain: params.get("domain") ?? undefined,
      actorId: params.get("actorId") ?? undefined,
      entityType: params.get("entityType") ?? undefined,
      entityId: params.get("entityId") ?? undefined,
      action: params.get("action") ?? undefined,
      beforeSequence: params.get("beforeSequence") ?? undefined,
      limit: params.get("limit") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: "Invalid audit query." }, { status: 400 });
    const events = await listAuditEvents({
      domain: parsed.data.domain as AuditDomain | undefined,
      actorId: parsed.data.actorId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      action: parsed.data.action,
      beforeSequence: parsed.data.beforeSequence ? BigInt(parsed.data.beforeSequence) : undefined,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ events, redacted: true, nextBeforeSequence: events.at(-1)?.sequence ?? null });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load audit events." : (error as Error).message }, { status });
  }
}
