import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { buildUserDataExport } from "@/server/dataExport";
import { consumeRateLimit, RateLimitedError } from "@/server/security/rateLimit";
import { log, requestIdOf } from "@/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Heavy query fan-out per export: 3 per rolling 24h per account.
const EXPORT_LIMIT = 3;
const EXPORT_WINDOW_SECONDS = 24 * 60 * 60;

/**
 * GET /api/account/data-export — GDPR self-service data portability. Returns
 * the account's complete personal-data record as a downloadable JSON
 * document. Excludes credentials and encrypted payment method details by
 * design (see src/server/dataExport.ts).
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  try {
    await consumeRateLimit({
      scope: "data-export:user",
      identifier: userId,
      limit: EXPORT_LIMIT,
      windowSeconds: EXPORT_WINDOW_SECONDS,
    });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many exports requested. Please try again later." },
        { status: 429, headers: { "retry-after": String(error.retryAfterSeconds) } },
      );
    }
    throw error;
  }

  try {
    const export_ = await buildUserDataExport(userId, request);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(export_, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="personal-data-export-${stamp}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    log.error("personal data export failed", { requestId: requestIdOf(request), error: String(error) });
    return NextResponse.json({ error: "Unable to build the data export." }, { status: 500 });
  }
}
