import { NextResponse } from "next/server";
import { requireBridgeToken, lookupPlatformUser } from "@/server/crmBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CRM bridge: resolve a platform user by email (for operator-confirmed
 *  customer linking). Read-only, token-gated. */
export async function GET(request: Request) {
  const denied = requireBridgeToken(request);
  if (denied) return denied;
  const email = new URL(request.url).searchParams.get("email")?.trim() ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const user = await lookupPlatformUser(email);
  if (!user) {
    return NextResponse.json({ error: "No platform user with this email." }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      platformUserId: user.id,
      email: user.email,
      name: user.name,
      registeredAt: user.createdAt.toISOString(),
      emailVerified: Boolean(user.emailVerifiedAt),
    },
  });
}
