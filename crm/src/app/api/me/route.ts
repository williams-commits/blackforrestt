import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in actor's identity and permissions (for cosmetic UI gating). */
export async function GET() {
  try {
    const context = await requirePermission("LEADS_READ");
    return NextResponse.json({ data: context });
  } catch (error) {
    return handleRouteError(error, "Unable to load session context.");
  }
}
