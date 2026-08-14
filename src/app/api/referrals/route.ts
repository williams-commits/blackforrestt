import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { getReferralStats } from "@/server/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/referrals — current user's referral code, link, stats, and referral list. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = await resolveUserId(session.user.id);
  const data = await getReferralStats(userId);
  return NextResponse.json(data);
}
