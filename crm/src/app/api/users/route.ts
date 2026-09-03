import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/guard";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Minimal staff directory (id, name, role) for assignment dropdowns.
 * Available to any authenticated CRM user with a core read permission.
 */
export async function GET() {
  try {
    await requirePermission("LEADS_READ");
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: { select: { key: true, name: true } },
        memberships: { select: { team: { select: { id: true, name: true } } } },
      },
    });
    return NextResponse.json({ data: users });
  } catch (error) {
    return handleRouteError(error, "Unable to load users.");
  }
}
