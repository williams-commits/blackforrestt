import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";
import { appendAuditEvent } from "@/server/ledger";
import { appendSecurityAudit } from "@/server/security/audit";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `New password must contain at least ${PASSWORD_MIN_LENGTH} characters.`)
    .max(PASSWORD_MAX_LENGTH, "New password is too long."),
});

/** POST /api/password — change the current user's password. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid password." },
      { status: 400 },
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { error: "New password must be different from the current password." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    await appendSecurityAudit({
      actorId: userId,
      action: "PASSWORD_CHANGE_REJECTED",
      entityType: "User",
      entityId: userId,
      metadata: { reason: "NO_LOCAL_PASSWORD" },
    });
    return NextResponse.json({ error: "This account does not have a local password." }, { status: 400 });
  }

  const currentPasswordMatches = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!currentPasswordMatches) {
    await appendSecurityAudit({
      actorId: userId,
      action: "PASSWORD_CHANGE_REJECTED",
      entityType: "User",
      entityId: userId,
      metadata: { reason: "CURRENT_PASSWORD" },
    });
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.$transaction(async (tx) => {
    const changedAt = new Date();
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: changedAt },
    });
    await tx.securitySession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(session?.securitySessionId ? { id: { not: session.securitySessionId } } : {}),
      },
      data: { revokedAt: changedAt },
    });
    await appendAuditEvent(tx, {
      actorId: userId,
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: userId,
    });
  }, { isolationLevel: "Serializable" });
  return NextResponse.json({ ok: true });
}
