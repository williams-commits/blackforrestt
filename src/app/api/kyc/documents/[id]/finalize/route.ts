import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { finalizeUpload } from "@/server/security/kycDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/kyc/documents/[id]/finalize
 * Server-authoritative verification: reads the uploaded object, checks
 * size/MIME/SHA-256, scans, and moves quarantine -> sealed (or BLOCKED).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const { id } = await params;
  if (!/^c[a-z0-9]{20,}$/i.test(id) && !/^[0-9a-f-]{32,}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid document id." }, { status: 400 });
  }

  try {
    const outcome = await finalizeUpload({ documentId: id, userId });
    if (outcome.kind === "not_found") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    if (outcome.kind === "conflict") {
      return NextResponse.json({ error: outcome.message }, { status: 409 });
    }
    return NextResponse.json(outcome.result);
  } catch (error) {
    console.error("KYC document finalization failed", error);
    return NextResponse.json({
      error: process.env.NODE_ENV === "production"
        ? "Document verification is temporarily unavailable."
        : "Document verification is unavailable. Check MinIO and KYC_SCANNER, then retry.",
    }, { status: 503 });
  }
}
