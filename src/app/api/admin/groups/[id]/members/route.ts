import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import { invalidateAllSettings } from "@/server/userSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addSchema = z.object({ userId: z.string().min(1) });

/** POST /api/admin/groups/[id]/members — add a user to the group. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id: groupId } = await params;
    const body = addSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const [group, user] = await Promise.all([
      prisma.userGroup.findUnique({ where: { id: groupId } }),
      prisma.user.findUnique({ where: { id: body.data.userId }, select: { id: true, name: true } }),
    ]);
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    try {
      await prisma.userGroupMembership.create({
        data: { userId: user.id, groupId, assignedBy: actorId },
      });
    } catch {
      return NextResponse.json({ ok: true, alreadyMember: true });
    }

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, groupId },
      update: {},
    });

    await prisma.$transaction(async (tx) => {
      await appendAuditEvent(tx, {
        actorId, action: "USER_GROUP_MEMBER_ADDED", entityType: "UserGroup", entityId: groupId,
        metadata: { userId: user.id, userName: user.name, groupName: group.name },
      });
    });

    invalidateAllSettings();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to add member." : (error as Error).message }, { status });
  }
}

/** DELETE /api/admin/groups/[id]/members?userId=... — remove a user from the group. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id: groupId } = await params;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId query param required" }, { status: 400 });

    await prisma.userGroupMembership.deleteMany({ where: { userId, groupId } });
    await prisma.userProfile.updateMany({ where: { userId, groupId }, data: { groupId: null } });

    const group = await prisma.userGroup.findUnique({ where: { id: groupId }, select: { name: true } });
    await prisma.$transaction(async (tx) => {
      await appendAuditEvent(tx, {
        actorId, action: "USER_GROUP_MEMBER_REMOVED", entityType: "UserGroup", entityId: groupId,
        metadata: { userId, groupName: group?.name },
      });
    });

    invalidateAllSettings();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to remove member." : (error as Error).message }, { status });
  }
}
