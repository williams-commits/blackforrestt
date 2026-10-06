import { NextResponse } from "next/server";
import { inboundTokenAllowed, InboundEmail, receiveInboundEmail } from "@/server/records/emails";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/emails/inbound — mail-provider ingestion webhook.
 *
 * Wire any inbound-mail provider (SendGrid Inbound Parse, SES, cloudmailin…)
 * to POST {from, to, subject, text, messageId?} here with
 * `Authorization: Bearer <INBOUND_EMAIL_TOKEN>`. The message is stored,
 * deduplicated by Message-ID, and auto-linked to a matching contact /
 * customer / lead by sender address. Disabled (503) until the token is set.
 */
export async function POST(request: Request) {
  try {
    if (!process.env.INBOUND_EMAIL_TOKEN?.trim()) {
      return NextResponse.json(
        { error: "Inbound email is not configured — set INBOUND_EMAIL_TOKEN." },
        { status: 503 },
      );
    }
    if (!inboundTokenAllowed(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const parsed = await parseJsonBody(request, InboundEmail);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await receiveInboundEmail(parsed.data) }, { status: 202 });
  } catch (error) {
    return handleRouteError(error, "Unable to record the inbound email.");
  }
}
