import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { getReferralStats } from "@/server/referrals";
import { currentBrandProfile } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/referrals — current user's referral code, link, stats, and referral list. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = await resolveUserId(session.user.id);
  // Legacy users (no stored brandDomain) still get links for the family they
  // are browsing from.
  const brand = await currentBrandProfile();
  const data = await getReferralStats(userId, brand.domain);
  return NextResponse.json(data);
}
