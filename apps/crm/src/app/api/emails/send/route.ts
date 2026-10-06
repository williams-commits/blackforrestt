import { NextResponse } from "next/server";
import { SendEmail, sendRecordEmail } from "@/server/records/emails";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";
import { emailConfigured } from "@/server/email";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Configured" = the caller can actually send: global SMTP, or their own
 *  admin-managed per-user SMTP credentials. */
export async function GET() {
  try {
    const ctx = await scopedContext("EMAILS_SEND");
    const userSmtp = await prisma.userSmtp.findUnique({ where: { userId: ctx.userId } });
    return NextResponse.json({ data: { configured: emailConfigured() || Boolean(userSmtp) } });
  } catch {
    return NextResponse.json({ data: { configured: emailConfigured() } });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, SendEmail);
    if (!parsed.ok) return parsed.response;
    // The email module's own capability governs sending; the service still
    // scope-checks the target record via resolveSubject.
    const ctx = await scopedContext("EMAILS_SEND");
    return NextResponse.json({ data: await sendRecordEmail(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to send email.");
  }
}
