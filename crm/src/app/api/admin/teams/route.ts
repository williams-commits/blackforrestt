import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/guard";
import {
  CreateTeam,
  UpdateTeam,
  createTeam,
  deleteTeam,
  updateTeam,
} from "@/server/records/adminManage";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdQuery = z.object({ id: z.string().min(5) });

export async function GET() {
  try {
    await requirePermission("TEAMS_MANAGE");
    const teams = await prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        leader: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        memberships: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    return NextResponse.json({ data: teams });
  } catch (error) {
    return handleRouteError(error, "Unable to load teams.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("TEAMS_MANAGE");
    const parsed = await parseJsonBody(request, CreateTeam);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createTeam(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create team.");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requirePermission("TEAMS_MANAGE");
    const id = new URL(request.url).searchParams.get("id");
    const parsedId = IdQuery.safeParse({ id });
    if (!parsedId.success) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const parsed = await parseJsonBody(request, UpdateTeam);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateTeam(ctx, parsedId.data.id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update team.");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requirePermission("TEAMS_MANAGE");
    const id = new URL(request.url).searchParams.get("id");
    const parsedId = IdQuery.safeParse({ id });
    if (!parsedId.success) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await deleteTeam(ctx, parsedId.data.id);
    return NextResponse.json({ data: { id: parsedId.data.id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete team.");
  }
}
