import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  deliverSecurityEmail,
  developmentEmailPreviewEnabled,
  issueSecurityToken,
  securityEmailProviderConfigured,
} from "@/server/security/tokens";
import { appendSecurityAudit } from "@/server/security/audit";
import { consumeRateLimit, RateLimitedError } from "@/server/security/rateLimit";
import { requestNetworkAddress } from "@/server/security/loginThrottle";
import { brandApexOrigin } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email-sending endpoints are abuse vectors (mail spray + user enumeration).
// Per-IP cap throttles bulk sending; the tight per-email cap stops endless
// verification mails for one address. Returns 429 without revealing whether
// the address has an account.
const IP_LIMIT = 10;
const EMAIL_LIMIT = 3;
const WINDOW_SECONDS = 15 * 60;

const Schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export async function POST(request: Request) {
  try {
    await consumeRateLimit({
      scope: "emailverify:ip",
      identifier: requestNetworkAddress(request),
      limit: IP_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "retry-after": String(error.retryAfterSeconds) } },
      );
    }
    throw error;
  }
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  try {
    await consumeRateLimit({
      scope: "emailverify:email",
      identifier: parsed.data.email,
      limit: EMAIL_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "retry-after": String(error.retryAfterSeconds) } },
      );
    }
    throw error;
  }
  const providerConfigured = securityEmailProviderConfigured();
  const previewEnabled = developmentEmailPreviewEnabled();
  if (!providerConfigured && !previewEnabled) {
    return NextResponse.json({ error: "Email delivery is not configured." }, { status: 503 });
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, emailVerifiedAt: true, brandDomain: true },
  });
  let previewUrl: string | undefined;
  if (user?.email && !user.emailVerifiedAt) {
    const issued = await issueSecurityToken({ userId: user.id, type: "EMAIL_VERIFICATION" });
    const url = new URL("/verify-email", brandApexOrigin(user.brandDomain ?? undefined));
    url.searchParams.set("token", issued.token);
    if (providerConfigured) {
      try {
        await deliverSecurityEmail({
          to: user.email,
          template: "verify-email",
          actionUrl: url.toString(),
          expiresAt: issued.expiresAt,
          userId: user.id,
          idempotencyKey: `security-token-${issued.record.id}`,
        });
        await appendSecurityAudit({
          actorId: user.id,
          action: "EMAIL_VERIFICATION_DELIVERED",
          entityType: "SecurityToken",
          entityId: issued.record.id,
        });
      } catch (error) {
        console.error("Verification email delivery failed", error);
        await appendSecurityAudit({
          actorId: user.id,
          action: "EMAIL_VERIFICATION_DELIVERY_FAILED",
          entityType: "SecurityToken",
          entityId: issued.record.id,
        });
        return NextResponse.json({ error: "Email delivery failed." }, { status: 503 });
      }
    } else {
      previewUrl = url.toString();
      await appendSecurityAudit({
        actorId: user.id,
        action: "EMAIL_VERIFICATION_PREVIEW_CREATED",
        entityType: "SecurityToken",
        entityId: issued.record.id,
      });
    }
  }
  return NextResponse.json({ accepted: true, ...(previewUrl ? { previewUrl } : {}) }, { status: 202 });
}
