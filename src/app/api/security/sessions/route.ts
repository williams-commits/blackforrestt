import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import {
  revokeAllSecuritySessions,
  revokeSecuritySession,
} from "@/server/security/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RevokeSchema = z.object({ sessionId: z.string().min(10).max(128) });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.securitySession.findMany({
    where: { userId: session.user.id },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    sessions: rows.map((row) => ({
      id: row.id,
      deviceName: row.deviceName,
      userAgent: row.userAgent,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      mfaVerifiedAt: row.mfaVerifiedAt?.toISOString() ?? null,
      current: row.id === session.securitySessionId,
    })),
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = RevokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  const revoked = await revokeSecuritySession({
    actorId: session.user.id,
    sessionId: parsed.data.sessionId,
    reason: "USER_REQUEST",
  });
  if (!revoked) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  return NextResponse.json({
    revoked: true,
    currentSessionRevoked: parsed.data.sessionId === session.securitySessionId,
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const count = await revokeAllSecuritySessions({
    userId: session.user.id,
    exceptSessionId: session.securitySessionId,
    reason: "USER_REVOKE_OTHER_SESSIONS",
  });
  return NextResponse.json({ revokedCount: count });
}
