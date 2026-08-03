import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { listDocuments } from "@/server/security/kycDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/kyc/documents — the requesting user's documents (status only, no bytes/URLs). */
export async function GET() {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const documents = await listDocuments(userId);
  return NextResponse.json({ documents });
}
