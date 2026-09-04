import { NextResponse } from "next/server";
import { z } from "zod";
import { exportRecords } from "@/server/records/export";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  object: z.enum(["leads", "contacts", "accounts", "customers"]),
  q: z.string().trim().max(120).optional(),
  statusId: z.string().trim().min(5).optional(),
});

const OBJECT_MAP = {
  leads: "LEAD",
  contacts: "CONTACT",
  accounts: "ACCOUNT",
  customers: "CUSTOMER",
} as const;

const PERMISSION_MAP = {
  leads: "LEADS_EXPORT",
  contacts: "CONTACTS_EXPORT",
  accounts: "ACCOUNTS_EXPORT",
  customers: "CUSTOMERS_EXPORT",
} as const;

/** CSV export of the current filtered view — scope- and permission-checked. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({
      object: params.get("object") ?? undefined,
      q: params.get("q") ?? undefined,
      statusId: params.get("statusId") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid export query." }, { status: 400 });
    }
    const object = parsed.data.object;
    const ctx = await scopedContext(PERMISSION_MAP[object]);
    const csv = await exportRecords(ctx, OBJECT_MAP[object], parsed.data);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${object}-export.csv"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to export.");
  }
}
