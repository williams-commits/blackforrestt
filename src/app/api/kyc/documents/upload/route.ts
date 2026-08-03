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

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);

/**
 * POST /api/kyc/documents/upload
 * Receives a document as multipart/form-data (fields: docType, file) and writes
 * its bytes straight to private quarantine storage through the app (same-origin,
 * so no provider CORS is required). The document stays PENDING_SCAN until finalize.
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
  const lowerName = file.name.toLowerCase();
  const declaredMime = file.type === "image/jpg"
    ? "image/jpeg"
    : file.type || (lowerName.endsWith(".pdf") ? "application/pdf" : lowerName.endsWith(".png") ? "image/png" : /\.jpe?g$/.test(lowerName) ? "image/jpeg" : "application/octet-stream");
  if (!ALLOWED_MIME.has(declaredMime)) {
    return NextResponse.json({ error: "Only JPEG, PNG, and PDF documents are accepted." }, { status: 400 });
  }

  const submission = await ensureOwnSubmission(userId);
  try {
    const result = await receiveUpload({
      userId,
      kycSubmissionId: submission.id,
      docType,
      declaredMime,
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
