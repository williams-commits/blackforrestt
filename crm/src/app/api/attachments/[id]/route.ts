import { NextResponse } from "next/server";
import { getAttachment } from "@/server/records/attachments";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download an attachment (scope-checked through its owning record). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await scopedContext("FILES_READ");
    const { id } = await context.params;
    const { attachment, data } = await getAttachment(ctx, id);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType,
        // Strip quotes AND control characters (C0/C1 + CRLF) - a filename
        // with control bytes produces an invalid header value and 500s
        // the download instead of header-injecting.
        "Content-Disposition": `attachment; filename="${attachment.filename.replaceAll(/["\p{C}]/gu, "").slice(0, 180)}"`,
        "Content-Length": String(data.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to download attachment.");
  }
}
