import { NextResponse } from "next/server";
import { hub } from "@/server/engine/hub";
import { resolveUserId } from "@/server/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/account — balance/credit/equity/margin/marginLevel/free/floatingPl. */
export async function GET() {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const account = await hub.readAccountMetrics(userId);
  return NextResponse.json(account);
}
