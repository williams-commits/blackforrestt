import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/guard";
import { handleRouteError } from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  appliesTo: z.enum(["LEAD", "CONTACT", "CUSTOMER"]).optional(),
});

/** Configurable record statuses for filter dropdowns and forms. */
export async function GET(request: Request) {
  try {
    await requirePermission("LEADS_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.parse({ appliesTo: params.get("appliesTo") ?? undefined });
    const statuses = await prisma.recordStatus.findMany({
      where: parsed.appliesTo ? { appliesTo: parsed.appliesTo } : undefined,
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, category: true, appliesTo: true, isDefault: true },
    });
    return NextResponse.json({ data: statuses });
  } catch (error) {
    return handleRouteError(error, "Unable to load statuses.");
  }
}
