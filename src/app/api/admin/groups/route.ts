import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import { invalidateAllSettings } from "@/server/userSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  settings: z.record(z.unknown()).optional(),
});

/** GET /api/admin/groups — list all groups with member counts. */
export async function GET() {
  try {
    await requireAdmin("USER_READ");
    const groups = await prisma.userGroup.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      groups: groups.map((g) => ({
        id: g.id, name: g.name, description: g.description, color: g.color,
        settings: g.settings, memberCount: g._count.members,
        createdAt: g.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to list groups." : (error as Error).message }, { status });
  }
}

/** POST /api/admin/groups — create a new group. */
export async function POST(req: Request) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const body = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Invalid group data" }, { status: 400 });

    const existing = await prisma.userGroup.findUnique({ where: { name: body.data.name } });
    if (existing) return NextResponse.json({ error: "A group with this name already exists" }, { status: 409 });

    const group = await prisma.userGroup.create({
      data: {
        name: body.data.name,
        description: body.data.description,
        color: body.data.color ?? "#6366f1",
        settings: body.data.settings ? JSON.parse(JSON.stringify(body.data.settings)) : {},
      },
    });

    await prisma.$transaction(async (tx) => {
      await appendAuditEvent(tx, {
        actorId, action: "USER_GROUP_CREATED", entityType: "UserGroup", entityId: group.id,
        metadata: { name: group.name, description: group.description, color: group.color },
      });
    });

    invalidateAllSettings();
    return NextResponse.json({
      group: { id: group.id, name: group.name, description: group.description, color: group.color,
        settings: group.settings, memberCount: 0, createdAt: group.createdAt.toISOString() },
    }, { status: 201 });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to create group." : (error as Error).message }, { status });
  }
}
