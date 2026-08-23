import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import {
  KycDocumentError,
  ensureOwnSubmission,
  receiveUpload,
} from "@/server/security/kycDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/kyc/documents/upload
 * Receives a document as multipart/form-data (fields: docType, file) and writes
 * its bytes straight to private quarantine storage through the app (same-origin,
 * so no provider CORS is required). The document stays PENDING_SCAN until finalize.
 *
 * The document type is resolved from the file's magic bytes server-side — the
 * browser's MIME reporting (file.type) is not trusted, so OS registry quirks
 * that map .jpeg files to exotic types can't reject genuine JPEGs.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const docType = String(form.get("docType") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const submission = await ensureOwnSubmission(userId);
  try {
    const result = await receiveUpload({
      userId,
      kycSubmissionId: submission.id,
      docType,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof KycDocumentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("KYC document upload failed", error);
    return NextResponse.json({
      error: process.env.NODE_ENV === "production"
        ? "Secure document storage is temporarily unavailable."
        : "Secure document storage is unavailable. Start MinIO and the minio-init service, then retry.",
    }, { status: 503 });
  }
}
