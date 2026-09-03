import { NextResponse } from "next/server";
import { z } from "zod";
import { findMatches } from "@/server/records/duplicates";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Check = z.object({
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  externalId: z.string().trim().max(120).optional(),
  excludeLeadId: z.string().trim().min(5).optional(),
});

/** Duplicate check on arbitrary keys (form-time or integrations). */
export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_READ");
    const parsed = await parseJsonBody(request, Check);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await findMatches(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to check duplicates.");
  }
}
