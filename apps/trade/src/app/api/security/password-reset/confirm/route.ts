import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/auth";
import { appendAuditEvent } from "@/server/ledger";
import { consumeSecurityToken } from "@/server/security/tokens";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().min(32).max(256),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH),
});

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Token or password is invalid." }, { status: 400 });
  const passwordHash = await hashPassword(parsed.data.newPassword);
  const reset = await consumeSecurityToken({
    token: parsed.data.token,
    type: "PASSWORD_RESET",
    apply: async (tx, record) => {
      const changedAt = new Date();
      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          passwordChangedAt: changedAt,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.securitySession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: changedAt },
      });
      await appendAuditEvent(tx, {
        actorId: record.userId,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "User",
        entityId: record.userId,
      });
      return true;
    },
  });
  if (!reset) return NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 400 });
  return NextResponse.json({ reset: true });
}
