import { NextResponse } from "next/server";
import { z } from "zod";
import { readEmail, setEmailRead } from "@/server/records/emails";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — open one email for reading (inbound mail is marked read). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("EMAILS_VIEW");
    const { id } = await context.params;
    return NextResponse.json({ data: await readEmail(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to open the email.");
  }
}

const Patch = z.object({ read: z.boolean() });

/** PATCH — mark read / unread (inbox triage). */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("EMAILS_VIEW");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, Patch);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await setEmailRead(ctx, id, parsed.data.read) });
  } catch (error) {
    return handleRouteError(error, "Unable to update the email.");
  }
}
