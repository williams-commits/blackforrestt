import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/server/ledger";
import { applicationOrigin, consumeSecurityToken } from "@/server/security/tokens";
import { queueUserEmail } from "@/server/email/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ token: z.string().min(32).max(256) });

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Verification token is invalid." }, { status: 400 });
  const verified = await consumeSecurityToken({
    token: parsed.data.token,
    type: "EMAIL_VERIFICATION",
    apply: async (tx, record) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
      await appendAuditEvent(tx, {
        actorId: record.userId,
        action: "EMAIL_VERIFIED",
        entityType: "User",
        entityId: record.userId,
      });
      await queueUserEmail(tx, { userId: record.userId, template: "email-verified", variables: { actionUrl: new URL("/account", applicationOrigin()).toString() } });
      return true;
    },
  });
  if (!verified) return NextResponse.json({ error: "Verification token is invalid or expired." }, { status: 400 });
  return NextResponse.json({ verified: true });
}
