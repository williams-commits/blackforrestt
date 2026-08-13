import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import { invalidateUserSettings } from "@/server/userSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  settings: z.record(z.unknown()).optional(),
  groupId: z.string().nullable().optional(),
});

/** GET /api/admin/users/[id]/profile — get a user's per-user settings. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin("USER_READ");
    const { id } = await params;
    const profile = await prisma.userProfile.findUnique({
      where: { userId: id },
      include: { group: { select: { id: true, name: true, color: true } } },
    });
    const memberships = await prisma.userGroupMembership.findMany({
      where: { userId: id },
      include: { group: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json({
      profile: profile ? {
        userId: profile.userId, settings: profile.settings,
        groupId: profile.groupId, group: profile.group,
      } : null,
      groups: memberships.map((m) => ({ id: m.group.id, name: m.group.name, color: m.group.color })),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load profile." : (error as Error).message }, { status });
  }
}

/** PATCH /api/admin/users/[id]/profile — set per-user settings overrides. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await params;
    const body = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const previous = await prisma.userProfile.findUnique({ where: { userId: id } });
    const settingsJson = body.data.settings ? JSON.parse(JSON.stringify(body.data.settings)) : {};
    const groupIdVal = body.data.groupId !== undefined ? body.data.groupId : previous?.groupId ?? null;

    const updated = await prisma.userProfile.upsert({
      where: { userId: id },
      create: { userId: id, settings: settingsJson, groupId: groupIdVal ?? null },
      update: {
        ...(body.data.settings ? { settings: settingsJson } : {}),
        ...(body.data.groupId !== undefined ? { groupId: body.data.groupId as string | null } : {}),
      },
    });

    await prisma.$transaction(async (tx) => {
      await appendAuditEvent(tx, {
        actorId, action: "USER_PROFILE_UPDATED", entityType: "User", entityId: id,
        metadata: { userName: user.name, after: updated.settings },
      });
    });

    invalidateUserSettings(id);
    return NextResponse.json({
      profile: { userId: updated.userId, settings: updated.settings, groupId: updated.groupId },
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to update profile." : (error as Error).message }, { status });
  }
}
