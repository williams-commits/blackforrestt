import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * CRM bridge — internal, read-only. The CRM application links its Customer
 * records to platform users and renders a client-360 panel; it can NEVER
 * write here. Access is gated by a shared secret (CRM_BRIDGE_TOKEN) held
 * by both applications, compared in constant time. Disabled (503) until
 * the token is configured.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function requireBridgeToken(request: Request): NextResponse | null {
  const expected = process.env.CRM_BRIDGE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "CRM bridge is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedHash = createHash("sha256").update(expected).digest();
  const presentedHash = createHash("sha256").update(presented).digest();
  if (presented.length === 0 || !timingSafeEqual(expectedHash, presentedHash)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

/** Minimal platform-user facts for the CRM's operator-confirmed linking. */
export async function lookupPlatformUser(email: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      emailVerifiedAt: true,
    },
  });
  return user;
}
