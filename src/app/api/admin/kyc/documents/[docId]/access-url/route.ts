import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AdminError } from "@/server/admin";
import { complianceDownload } from "@/server/security/kycDocuments";
import { requestNetworkAddress } from "@/server/security/loginThrottle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  reason: z.string().trim().min(3).max(500),
});

/**
 * POST /api/admin/kyc/documents/[docId]/access-url
 * Authorizes compliance review of a CLEAN document (recording actor/reason and
 * the requesting network) and streams the object bytes back to the admin as a
 * same-origin download. No cross-origin request to object storage is made, so no
 * provider bucket-CORS configuration is required.
 */
export async function POST(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  let adminId: string;
  try {
    adminId = await requireAdmin("KYC_DOCUMENT_ACCESS");
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }
  const { docId } = await params;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A review reason is required." }, { status: 400 });
  }

  try {
    const result = await complianceDownload({
      documentId: docId,
      actorId: adminId,
      reason: parsed.data.reason,
      networkAddress: requestNetworkAddress(req),
    });
    if (!result.ok) {
      if (result.reason === "storage_missing") {
        return NextResponse.json(
          { error: "The document record exists, but its stored bytes are missing — secure storage was likely reset. Ask the customer to re-upload the document." },
          { status: 410 },
        );
      }
      return NextResponse.json(
        { error: "Document is not available for compliance review." },
        { status: 404 },
      );
    }
    // Stream the bytes through the app origin as an inline attachment. The audit
    // row and event were written inside complianceDownload.
    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(result.bytes.length),
        "Content-Disposition": `inline; filename="${result.docType}-${result.documentId}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("KYC document access failed", error);
    return NextResponse.json({ error: "Unable to open the document. Try again." }, { status: 500 });
  }
}
