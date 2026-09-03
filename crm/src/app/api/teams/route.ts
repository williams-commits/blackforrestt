import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/guard";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Team directory (read-only) for the admin page and pickers. */
export async function GET() {
  try {
    await requirePermission("LEADS_READ");
    const teams = await prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        leader: { select: { id: true, name: true } },
        memberships: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    return NextResponse.json({
      data: teams.map((team) => ({
        id: team.id,
        name: team.name,
        parentId: team.parentId,
        leader: team.leader,
        members: team.memberships.map((membership) => membership.user),
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load teams.");
  }
}
