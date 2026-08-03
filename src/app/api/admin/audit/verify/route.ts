import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { verifyAuditChain } from "@/server/audit";
import { withSerializableRetry } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const actorId = await requireAdmin("AUDIT_VERIFY");
    const result = await verifyAuditChain();
    await withSerializableRetry((tx) => appendAuditEvent(tx, {
      domain: "ADMIN",
      actorId,
      action: "AUDIT_CHAIN_VERIFIED",
      entityType: "AuditEvent",
      metadata: { valid: result.valid, checkedEvents: result.checkedEvents, headHash: result.headHash },
    }));
    return NextResponse.json(result, { status: result.valid ? 200 : 409 });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to verify audit chain." : (error as Error).message }, { status });
  }
}
