import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { MatchRules, startImport } from "@/server/imports/csvImport";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retry an import: the stored payload is re-validated and re-run as a NEW
 * job (history is append-only). Failed rows that were fixed upstream can
 * then be imported; already-created rows surface as duplicates per strategy.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await scopedContext("LEADS_IMPORT");
    const { id } = await context.params;
    const original = await prisma.importJob.findFirst({
      where: { id, createdById: ctx.userId },
    });
    if (!original) throw new CrmError("Import job not found.", 404);
    if (!original.payload) throw new CrmError("The original payload is unavailable for retry.", 400);
    const result = await startImport(ctx, {
      objectType: original.objectType as never,
      strategy: original.strategy,
      mapping: (original.mapping ?? {}) as Record<string, string>,
      matchRules: MatchRules.parse(original.matchRules ?? {}),
      rows: original.payload as never,
      fileName: (original.fileKey ?? "retry") + " (retry)",
    });
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (error) {
    return handleRouteError(error, "Unable to retry import.");
  }
}
