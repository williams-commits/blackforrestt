import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  applicationOrigin,
  deliverSecurityEmail,
  developmentEmailPreviewEnabled,
  issueSecurityToken,
  securityEmailProviderConfigured,
} from "@/server/security/tokens";
import { appendSecurityAudit } from "@/server/security/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  const providerConfigured = securityEmailProviderConfigured();
  const previewEnabled = developmentEmailPreviewEnabled();
  if (!providerConfigured && !previewEnabled) {
    return NextResponse.json({ error: "Email delivery is not configured." }, { status: 503 });
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  let previewUrl: string | undefined;
  if (user?.email && user.emailVerifiedAt) {
    const issued = await issueSecurityToken({ userId: user.id, type: "PASSWORD_RESET" });
    const url = new URL("/reset-password", applicationOrigin());
    url.searchParams.set("token", issued.token);
    if (providerConfigured) {
      try {
        await deliverSecurityEmail({
          to: user.email,
          template: "password-reset",
          actionUrl: url.toString(),
          expiresAt: issued.expiresAt,
          userId: user.id,
          idempotencyKey: `security-token-${issued.record.id}`,
        });
        await appendSecurityAudit({
          actorId: user.id,
          action: "PASSWORD_RESET_DELIVERED",
          entityType: "SecurityToken",
          entityId: issued.record.id,
        });
      } catch (error) {
        console.error("Password reset email delivery failed", error);
        await appendSecurityAudit({
          actorId: user.id,
          action: "PASSWORD_RESET_DELIVERY_FAILED",
          entityType: "SecurityToken",
          entityId: issued.record.id,
        });
        return NextResponse.json({ error: "Email delivery failed." }, { status: 503 });
      }
    } else {
      previewUrl = url.toString();
      await appendSecurityAudit({
        actorId: user.id,
        action: "PASSWORD_RESET_PREVIEW_CREATED",
        entityType: "SecurityToken",
        entityId: issued.record.id,
      });
    }
  }
  return NextResponse.json({ accepted: true, ...(previewUrl ? { previewUrl } : {}) }, { status: 202 });
}
