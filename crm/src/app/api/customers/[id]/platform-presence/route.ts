import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomer } from "@/server/records/customers";
import { scopedContext } from "@/server/records/leads";
import { platformPresence } from "@/server/platformBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().trim().min(5) });

/**
 * Live platform presence for one linked customer. Scope-gated like the
 * page itself (CUSTOMERS_VIEW + getCustomer); reads through the read-only
 * platform bridge, so `reachable: false` means the bridge is down — never
 * report a false "offline" for it.
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
      return NextResponse.json({ data: { linked: false, reachable: false, online: false } });
    }
    const states = await platformPresence([customer.platformUserId]);
    const state = states.find((entry) => entry.platformUserId === customer.platformUserId) ?? null;
    return NextResponse.json({
      data: {
        linked: true,
        reachable: state !== null,
        online: state?.online ?? false,
        openPositions: state?.openPositions ?? 0,
      },
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 404) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    return NextResponse.json({ error: "Unable to load presence." }, { status: 500 });
  }
}
