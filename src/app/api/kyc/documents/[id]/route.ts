import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { cancelUpload } from "@/server/security/kycDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/kyc/documents/[id]
 * Cancels a not-yet-cleaned upload (deletes the quarantine object and the row).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const { id } = await params;

  const cancelled = await cancelUpload({ documentId: id, userId });
  if (!cancelled) {
    return NextResponse.json(
      { error: "Document could not be cancelled (it may already be finalized)." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
