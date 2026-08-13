import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import { invalidateAllSettings } from "@/server/userSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  settings: z.record(z.unknown()).optional(),
});

/** GET /api/admin/groups/[id] — group detail with members. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin("USER_READ");
    const { id } = await params;
    const group = await prisma.userGroup.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, accountNo: true, verified: true,
                metrics: { select: { balance: true, equity: true, floatingPl: true } } },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
        _count: { select: { members: true } },
      },
    });
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    return NextResponse.json({
      group: {
        id: group.id, name: group.name, description: group.description, color: group.color,
        settings: group.settings, memberCount: group._count.members,
        createdAt: group.createdAt.toISOString(),
        members: group.members.map((m) => ({
          id: m.id, assignedAt: m.assignedAt.toISOString(),
          user: {
            id: m.user.id, name: m.user.name, email: m.user.email, accountNo: m.user.accountNo,
            verified: m.user.verified,
            balance: m.user.metrics ? Number(m.user.metrics.balance) : 0,
            equity: m.user.metrics ? Number(m.user.metrics.equity) : 0,
            floatingPl: m.user.metrics ? Number(m.user.metrics.floatingPl) : 0,
          },
        })),
      },
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load group." : (error as Error).message }, { status });
  }
}

/** PATCH /api/admin/groups/[id] — update group. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await params;
    const body = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Invalid update data" }, { status: 400 });

    const existing = await prisma.userGroup.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    if (body.data.name && body.data.name !== existing.name) {
      const nameConflict = await prisma.userGroup.findUnique({ where: { name: body.data.name } });
      if (nameConflict) return NextResponse.json({ error: "Name already in use" }, { status: 409 });
    }

    const updated = await prisma.userGroup.update({
      where: { id },
      data: {
        ...(body.data.name ? { name: body.data.name } : {}),
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
        ...(body.data.color ? { color: body.data.color } : {}),
        ...(body.data.settings ? { settings: JSON.parse(JSON.stringify(body.data.settings)) } : {}),
      },
    });

    await prisma.$transaction(async (tx) => {
      await appendAuditEvent(tx, {
        actorId, action: "USER_GROUP_UPDATED", entityType: "UserGroup", entityId: id,
        metadata: { before: { name: existing.name }, after: { name: updated.name } },
      });
    });

    invalidateAllSettings();
    return NextResponse.json({
      group: { id: updated.id, name: updated.name, description: updated.description,
        color: updated.color, settings: updated.settings },
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to update group." : (error as Error).message }, { status });
  }
}

/** DELETE /api/admin/groups/[id] — delete group (memberships cascade). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await params;
    const existing = await prisma.userGroup.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    await prisma.userGroup.delete({ where: { id } });

    await prisma.$transaction(async (tx) => {
      await appendAuditEvent(tx, {
        actorId, action: "USER_GROUP_DELETED", entityType: "UserGroup", entityId: id,
        metadata: { name: existing.name },
      });
    });

    invalidateAllSettings();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to delete group." : (error as Error).message }, { status });
  }
}
