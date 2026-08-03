import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin, AdminError } from "@/server/admin";
import { listDocumentsForSubmission } from "@/server/security/kycDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/kyc/[id]/documents
 * Lists documents attached to a submission. Compliance-only metadata — no bytes,
 * no usable URLs (downloads are minted separately with a recorded reason).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let adminId: string;
  try {
    adminId = await requireAdmin("KYC_READ");
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }
  const { id } = await params;

  const submission = await prisma.kycSubmission.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!submission) return NextResponse.json({ error: "KYC submission not found." }, { status: 404 });

  const documents = await listDocumentsForSubmission(id);
  return NextResponse.json({ documents, requestedBy: adminId });
}
