import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma, withSerializableRetry } from "@/server/db";
import {
  appendAuditEvent,
  ensureSystemAccount,
  ensureUserLedgerAccount,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
} from "@/server/ledger";
import { resolveUserSettings } from "@/server/userSettings";
import {
  applicationOrigin,
  deliverSecurityEmail,
  developmentEmailPreviewEnabled,
  issueSecurityToken,
  securityEmailProviderConfigured,
} from "@/server/security/tokens";
import { appendSecurityAudit } from "@/server/security/audit";
import { sendImmediateEmail } from "@/server/email/service";
import { createReferral } from "@/server/referrals";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
    .max(PASSWORD_MAX_LENGTH),
  referralCode: z.string().trim().max(20).optional(),
});

function registrationRequiresEmailVerification(): boolean {
  return (process.env.REGISTRATION_REQUIRE_EMAIL_VERIFICATION ?? "false").toLowerCase() === "true";
}

const ACCOUNT_NUMBER_ATTEMPTS = 10;

/** POST /api/register — create a uniquely numbered simulation account. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  // Avoid an expensive bcrypt operation for an email that already exists. The
  // unique constraint below remains the authoritative race-safe check.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
  if (existing) {
    return NextResponse.json(
      {
        error: "An account with that email already exists.",
        // True only when the existing account is still unverified, so the
        // client can offer a resend-verification action in that case alone.
        needsVerification: !existing.emailVerifiedAt,
      },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const requireEmailVerification = registrationRequiresEmailVerification();

  for (let attempt = 0; attempt < ACCOUNT_NUMBER_ATTEMPTS; attempt += 1) {
    const accountNo = String(randomInt(1_000_000, 10_000_000));
    try {
      const user = await withSerializableRetry(
        async (tx) => {
          const created = await tx.user.create({
            data: {
              name,
              email,
              passwordHash,
              accountNo,
              verified: !requireEmailVerification,
              emailVerifiedAt: requireEmailVerification ? null : new Date(),
            },
            select: { id: true, email: true, name: true, accountNo: true },
          });
          await ensureUserLedgerAccount(tx, created.id, "AVAILABLE");
          // Demo starting balance — resolved per new user (group/profile
          // overrides don't exist yet at registration, so this is the global
          // .env preset DEMO_STARTING_BALANCE; 0/unset = start empty, the
          // legacy behavior).
          const startingBalance = (await resolveUserSettings(created.id)).balance.demoStartingBalance;
          if (startingBalance > 0) {
            const funding = await ensureSystemAccount(tx, "DEMO_FUNDING_EXPENSE");
            const available = await ensureUserLedgerAccount(tx, created.id, "AVAILABLE");
            const amount = money(startingBalance.toFixed(2));
            await postLedgerTransaction(tx, {
              reference: `DEMO_START:${created.id}`,
              kind: "DEMO_FUNDING",
              description: "Demo account starting balance",
              userId: created.id,
              sourceType: "User",
              sourceId: created.id,
              lines: [
                { accountId: funding.id, direction: "DEBIT", amount, asset: "USD" },
                { accountId: available.id, direction: "CREDIT", amount, asset: "USD" },
              ],
            });
          }
          await refreshLedgerProjections(tx, created.id);
          await appendAuditEvent(tx, {
            actorId: created.id,
            action: "ACCOUNT_CREATED",
            entityType: "User",
            entityId: created.id,
            metadata: { asset: "USD" },
          });
          return created;
        },
        { operation: `registration for ${email}` },
      );

      // Process referral code if provided.
      if (parsed.data.referralCode) {
        try {
          await createReferral(parsed.data.referralCode, user.id);
        } catch (error) {
          console.error("Referral creation failed", error);
          // Non-fatal — user is still created successfully.
        }
      }

      let verificationDelivery: "sent" | "preview" | "not_configured" | "failed" = "not_configured";
      let verificationPreviewUrl: string | undefined;
      if (requireEmailVerification && user.email) {
        const issued = await issueSecurityToken({
          userId: user.id,
          type: "EMAIL_VERIFICATION",
        });
        const verificationUrl = new URL("/verify-email", applicationOrigin());
        verificationUrl.searchParams.set("token", issued.token);

        if (securityEmailProviderConfigured()) {
          try {
            await deliverSecurityEmail({
              to: user.email,
              template: "verify-email",
              actionUrl: verificationUrl.toString(),
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
            verificationDelivery = "sent";
          } catch (error) {
            verificationDelivery = "failed";
            console.error("Registration verification delivery failed", error);
            await appendSecurityAudit({
              actorId: user.id,
              action: "EMAIL_VERIFICATION_DELIVERY_FAILED",
              entityType: "SecurityToken",
              entityId: issued.record.id,
            });
          }
        } else if (developmentEmailPreviewEnabled()) {
          verificationDelivery = "preview";
          verificationPreviewUrl = verificationUrl.toString();
          await appendSecurityAudit({
            actorId: user.id,
            action: "EMAIL_VERIFICATION_PREVIEW_CREATED",
            entityType: "SecurityToken",
            entityId: issued.record.id,
          });
        }
      }
      if (!requireEmailVerification && user.email) {
        try {
          await sendImmediateEmail({
            userId: user.id,
            to: user.email,
            template: "welcome",
            variables: { name: user.name ?? "there", actionUrl: new URL("/account", applicationOrigin()).toString() },
            idempotencyKey: `welcome-${user.id}`,
          });
        } catch (error) {
          console.error("Welcome email delivery failed", error);
        }
      }
      return NextResponse.json(
        {
          ok: true,
          user,
          emailVerified: !requireEmailVerification,
          loginAllowed: !requireEmailVerification,
          verificationDelivery,
          ...(verificationPreviewUrl ? { verificationPreviewUrl } : {}),
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("email")) {
          return NextResponse.json(
            { error: "An account with that email already exists." },
            { status: 409 },
          );
        }
        if (targets.includes("accountNo")) continue;
      }
      console.error("Registration failed:", error);
      return NextResponse.json({ error: "Unable to create the account." }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Unable to allocate an account number. Please retry." },
    { status: 503 },
  );
}
