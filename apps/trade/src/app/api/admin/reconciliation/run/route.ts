import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import {
  ReconciliationRunInProgressError,
  scheduledReconciliationReference,
} from "@/server/reconciliation";
import {
  reconciliationScheduler,
  ReconciliationSchedulerBusyError,
} from "@/server/reconciliationScheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  reference: z.string().trim().min(8).max(160).optional(),
  windowStart: z.coerce.date().optional(),
  windowEnd: z.coerce.date().optional(),
}).superRefine((value, ctx) => {
  if ((value.windowStart && !value.windowEnd) || (!value.windowStart && value.windowEnd)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "windowStart and windowEnd must be supplied together." });
  }
  if (value.windowStart && value.windowEnd && value.windowStart >= value.windowEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "windowStart must be before windowEnd." });
  }
});

export async function POST(request: Request) {
  try {
    const actorId = await requireAdmin("RECONCILIATION_MANAGE");
    const parsed = Schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reconciliation request.", details: parsed.error.flatten() }, { status: 400 });
    }

    const reference = parsed.data.reference ?? (
      parsed.data.windowStart && parsed.data.windowEnd
        ? scheduledReconciliationReference(parsed.data.windowStart, parsed.data.windowEnd)
        : undefined
    );
    const result = await reconciliationScheduler.runNow({
      trigger: "MANUAL",
      requestedBy: actorId,
      reference,
      windowStart: parsed.data.windowStart,
      windowEnd: parsed.data.windowEnd,
    });
    return NextResponse.json({ ok: true, run: result });
  } catch (error) {
    if (error instanceof ReconciliationSchedulerBusyError || error instanceof ReconciliationRunInProgressError) {
      return NextResponse.json({ error: error.message, code: "RECONCILIATION_BUSY" }, { status: 409 });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Manual reconciliation failed", error);
    return NextResponse.json(
      { error: status === 500 ? "Unable to run reconciliation." : error instanceof Error ? error.message : "Unable to run reconciliation." },
      { status },
    );
  }
}
