import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupPlatformUser } from "@/server/platformBridge";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ email: z.string().trim().email() });

/** Bridge lookup by email — supports the operator-confirmed link flow. */
export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("CUSTOMERS_READ");
    const parsed = await parseJsonBody(request, Query);
    if (!parsed.ok) return parsed.response;
    const result = await lookupPlatformUser(ctx, parsed.data.email);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleRouteError(error, "Platform lookup failed.");
  }
}
