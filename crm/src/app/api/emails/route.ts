import { NextResponse } from "next/server";
import { listMailbox, MailboxQuery } from "@/server/records/emails";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/emails — the mailbox.
 *   ?folder=inbox|sent|all  &unread=1  &q=…  &page=…
 *   ?subjectType=CONTACT&subjectId=…  → that record's full email history.
 */
export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("EMAILS_VIEW");
    const params = new URL(request.url).searchParams;
    const parsed = MailboxQuery.safeParse({
      folder: params.get("folder") ?? undefined,
      unread: params.get("unread") ?? undefined,
      q: params.get("q") ?? undefined,
      subjectType: params.get("subjectType") ?? undefined,
      subjectId: params.get("subjectId") ?? undefined,
      page: params.get("page") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: "Invalid mailbox query." }, { status: 400 });
    return NextResponse.json({ data: await listMailbox(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to load the mailbox.");
  }
}
