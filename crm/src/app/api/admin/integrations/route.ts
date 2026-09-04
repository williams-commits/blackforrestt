import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { emailConfigured } from "@/server/email";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Integration status (read-only — configuration is env-based). */
export async function GET() {
  try {
    await requirePermission("SETTINGS_MANAGE");
    return NextResponse.json({
      data: {
        platformBridge: {
          enabled: Boolean(process.env.PLATFORM_BRIDGE_URL && process.env.PLATFORM_BRIDGE_TOKEN),
          url: process.env.PLATFORM_BRIDGE_URL ?? null,
        },
        email: {
          enabled: emailConfigured(),
          from: process.env.SMTP_FROM ?? null,
        },
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load integrations.");
  }
}
