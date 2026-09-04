import { NextResponse } from "next/server";
import { SendEmail, sendRecordEmail } from "@/server/records/emails";
import { subjectEditPermission } from "@/server/records/subjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";
import { emailConfigured } from "@/server/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ data: { configured: emailConfigured() } });
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, SendEmail);
    if (!parsed.ok) return parsed.response;
    const ctx = await scopedContext(subjectEditPermission(parsed.data.subjectType));
    return NextResponse.json({ data: await sendRecordEmail(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to send email.");
  }
}
