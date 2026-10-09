import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomer } from "@/server/records/customers";
import { scopedContext } from "@/server/records/leads";
import { client360 } from "@/server/platformBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().trim().min(5) });

/**
 * Customer trading context — the CRM-side face of the cross-module Customer
 * 360 capability. Scope-gated exactly like the customer page
 * (CUSTOMERS_VIEW + getCustomer), reads through the read-only platform
 * bridge, and answers with an honest three-state contract:
 *
 *   { linked: false }                      — no platform user linked
 *   { linked: true, available: false }     — linked, bridge/platform down
 *   { linked: true, available: true, context, fetchedAt }
 *
 * The response never writes anywhere and carries only what the bridge's
 * versioned client-360 contract already exposes.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await scopedContext("CUSTOMERS_VIEW");
    const { id } = await context.params;
    if (!Params.shape.id.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid customer." }, { status: 400 });
    }
    const customer = await getCustomer(ctx, id);
    if (!customer.platformUserId) {
      return NextResponse.json({ data: { linked: false } });
    }
    const context360 = await client360(customer.platformUserId);
    if (!context360 || context360.version !== 1) {
      return NextResponse.json({ data: { linked: true, available: false } });
    }
    return NextResponse.json({
      data: { linked: true, available: true, context: context360, fetchedAt: new Date().toISOString() },
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 404) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    return NextResponse.json({ error: "Unable to load trading context." }, { status: 500 });
  }
}
