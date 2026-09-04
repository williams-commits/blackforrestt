import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { CrmError, type CrmContext } from "@/server/guard";
import { appendAudit } from "@/server/audit";

/**
 * Staff administration: users, teams, role permission matrices, and system
 * settings. Mutations require USERS_MANAGE / TEAMS_MANAGE / ROLES_MANAGE /
 * SETTINGS_MANAGE respectively (enforced by routes) and are audit-logged.
 */

export const CreateUser = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(10).max(200),
  roleKey: z.string().trim().min(2),
  teamIds: z.array(z.string().min(5)).max(10).default([]),
});

export const UpdateUser = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  roleKey: z.string().trim().min(2).optional(),
  teamIds: z.array(z.string().min(5)).max(10).optional(),
  password: z.string().min(10).max(200).optional(),
});

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      lastLoginAt: true,
      role: { select: { key: true, name: true } },
      memberships: { include: { team: { select: { id: true, name: true } } } },
    },
  });
  return users;
}

async function assertRole(roleKey: string) {
  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) throw new CrmError("Unknown role.", 400);
  return role;
}

export async function createUser(ctx: CrmContext, input: z.infer<typeof CreateUser>) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new CrmError("A user with this email already exists.", 400);
  const role = await assertRole(input.roleKey);
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name,
        passwordHash,
        roleId: role.id,
        memberships: { create: input.teamIds.map((teamId) => ({ teamId })) },
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "USER_CREATED",
      objectType: "User",
      objectId: user.id,
      after: { email, roleKey: role.key },
    });
    return { id: user.id, email: user.email };
  });
}

export async function updateUser(ctx: CrmContext, id: string, input: z.infer<typeof UpdateUser>) {
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { memberships: true, role: true },
  });
  if (!existing) throw new CrmError("User not found.", 404);
  if (input.roleKey) await assertRole(input.roleKey);

  // Guardrail: never lock yourself out of administration.
  if (id === ctx.userId && (input.status === "DISABLED" || input.status === "SUSPENDED")) {
    throw new CrmError("You cannot suspend or disable your own account.", 400);
  }
  const demotingSelf =
    id === ctx.userId &&
    input.roleKey !== undefined &&
    existing.role.key === "SUPER_ADMIN" &&
    input.roleKey !== "SUPER_ADMIN";
  if (demotingSelf) {
    throw new CrmError("You cannot demote your own super-admin account.", 400);
  }

  return prisma.$transaction(async (tx) => {
    if (input.roleKey) {
      const role = await tx.role.findUnique({ where: { key: input.roleKey } });
      if (role) await tx.user.update({ where: { id }, data: { roleId: role.id } });
    }
    await tx.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.password !== undefined
          ? { passwordHash: await bcrypt.hash(input.password, 12) }
          : {}),
      },
    });
    if (input.teamIds !== undefined) {
      await tx.teamMembership.deleteMany({ where: { userId: id } });
      await tx.teamMembership.createMany({
        data: input.teamIds.map((teamId) => ({ userId: id, teamId })),
      });
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "USER_UPDATED",
      objectType: "User",
      objectId: id,
      before: { status: existing.status, roleKey: existing.role.key },
      after: {
        status: input.status ?? existing.status,
        roleKey: input.roleKey ?? existing.role.key,
        passwordReset: input.password !== undefined,
        teamIds: input.teamIds,
      },
    });
    return { id };
  });
}

/**
 * Permanently delete a user account. Requires explicit confirmation.
 * Checks: cannot delete yourself, cannot delete the last Super Admin.
 * Audit-logged with the user's email preserved in the audit entry.
 */
export async function deleteUser(ctx: CrmContext, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { select: { key: true } },
      _count: {
        select: {
          assignedLeads: true,
          ownedAccounts: true,
          ownedContacts: true,
          ownedCustomers: true,
          ownedOpps: true,
          ownedTasks: true,
          authoredNotes: true,
        },
      },
    },
  });
  if (!user) throw new CrmError("User not found.", 404);

  // Guardrail: cannot delete yourself
  if (userId === ctx.userId) {
    throw new CrmError("You cannot delete your own account.", 400);
  }

  // Guardrail: cannot delete the last Super Admin
  if (user.role.key === "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({
      where: {
        status: "ACTIVE",
        role: { key: "SUPER_ADMIN" },
        id: { not: userId },
      },
    });
    if (superAdminCount === 0) {
      throw new CrmError("Cannot delete the last Super Admin — promote another admin first.", 400);
    }
  }

  // Check for owned records — warn but allow (records become orphaned)
  const ownedRecords =
    user._count.assignedLeads + user._count.ownedAccounts +
    user._count.ownedContacts + user._count.ownedCustomers +
    user._count.ownedOpps + user._count.ownedTasks + user._count.authoredNotes;

  await prisma.$transaction(async (tx) => {
    // Reassign owned records to the deleting admin (or nullify)
    await tx.lead.updateMany({
      where: { assignedUserId: userId },
      data: { assignedUserId: ctx.userId },
    });
    await tx.account.updateMany({
      where: { ownerUserId: userId },
      data: { ownerUserId: ctx.userId },
    });
    await tx.contact.updateMany({
      where: { ownerUserId: userId },
      data: { ownerUserId: ctx.userId },
    });
    await tx.customer.updateMany({
      where: { ownerUserId: userId },
      data: { ownerUserId: ctx.userId },
    });
    await tx.opportunity.updateMany({
      where: { ownerUserId: userId },
      data: { ownerUserId: ctx.userId },
    });
    await tx.task.updateMany({
      where: { ownerUserId: userId },
      data: { ownerUserId: ctx.userId },
    });

    // Delete the user (memberships cascade)
    await tx.user.delete({ where: { id: userId } });

    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "USER_DELETED",
      objectType: "User",
      objectId: userId,
      before: {
        email: user.email,
        name: user.name,
        roleKey: user.role.key,
        ownedRecordsReassigned: ownedRecords,
      },
    });
  });
}

export const CreateTeam = z.object({
  name: z.string().trim().min(2).max(80),
  leaderId: z.string().trim().min(5).optional().nullable(),
  parentId: z.string().trim().min(5).optional().nullable(),
  memberIds: z.array(z.string().min(5)).max(100).default([]),
});

export const UpdateTeam = CreateTeam.partial();

async function assertNoCycle(teamId: string, parentId: string | null) {
  if (!parentId) return;
  let current: string | null = parentId;
  const seen = new Set<string>();
  while (current) {
    if (current === teamId) throw new CrmError("Team hierarchy would form a cycle.", 400);
    if (seen.has(current)) break;
    seen.add(current);
    const parentRow: { parentId: string | null } | null = await prisma.team.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parentRow?.parentId ?? null;
  }
}

export async function createTeam(ctx: CrmContext, input: z.infer<typeof CreateTeam>) {
  const existing = await prisma.team.findUnique({ where: { name: input.name } });
  if (existing) throw new CrmError("A team with this name already exists.", 400);
  await assertNoCycle("__new__", input.parentId ?? null);
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        name: input.name,
        leaderId: input.leaderId ?? null,
        parentId: input.parentId ?? null,
        memberships: { create: input.memberIds.map((userId) => ({ userId })) },
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "TEAM_CREATED",
      objectType: "Team",
      objectId: team.id,
      after: { name: team.name },
    });
    return team;
  });
}

export async function updateTeam(ctx: CrmContext, id: string, input: z.infer<typeof UpdateTeam>) {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Team not found.", 404);
  if (input.name) {
    const clash = await prisma.team.findUnique({ where: { name: input.name } });
    if (clash && clash.id !== id) throw new CrmError("A team with this name already exists.", 400);
  }
  await assertNoCycle(id, input.parentId !== undefined ? input.parentId : existing.parentId);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.team.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.leaderId !== undefined ? { leaderId: input.leaderId } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      },
    });
    if (input.memberIds !== undefined) {
      await tx.teamMembership.deleteMany({ where: { teamId: id } });
      await tx.teamMembership.createMany({
        data: input.memberIds.map((userId) => ({ teamId: id, userId })),
      });
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "TEAM_UPDATED",
      objectType: "Team",
      objectId: id,
      before: { name: existing.name, leaderId: existing.leaderId },
      after: { name: saved.name, leaderId: saved.leaderId, memberIds: input.memberIds },
    });
    return saved;
  });
}

export async function deleteTeam(ctx: CrmContext, id: string) {
  const existing = await prisma.team.findUnique({
    where: { id },
    include: { _count: { select: { memberships: true, children: true, assignedLeads: true, ownedAccounts: true, ownedCustomers: true, ownedOpps: true, contacts: true } } },
  });
  if (!existing) throw new CrmError("Team not found.", 404);
  const usage =
    existing._count.assignedLeads + existing._count.ownedAccounts +
    existing._count.ownedCustomers + existing._count.ownedOpps + existing._count.contacts;
  if (usage > 0) {
    throw new CrmError(`Team is referenced by ${usage} record(s) — reassign them first.`, 400);
  }
  if (existing._count.children > 0) {
    throw new CrmError("Team has child teams — move or delete them first.", 400);
  }
  await prisma.$transaction(async (tx) => {
    await tx.team.delete({ where: { id } }); // memberships cascade
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "TEAM_DELETED",
      objectType: "Team",
      objectId: id,
      before: { name: existing.name },
    });
  });
}

/** Roles with their permission sets (matrix editable via ROLES_MANAGE). */
export async function listRoles() {
  return prisma.role.findMany({
    orderBy: { key: "asc" },
    include: { permissions: { select: { permission: true } }, _count: { select: { users: true } } },
  });
}

export const UpdateRolePermissions = z.object({
  permissions: z.array(z.string().trim().min(2)).max(200),
});

export async function updateRolePermissions(
  ctx: CrmContext,
  roleId: string,
  input: z.infer<typeof UpdateRolePermissions>,
) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { permissions: true } });
  if (!role) throw new CrmError("Role not found.", 404);
  if (role.key === "SUPER_ADMIN") {
    throw new CrmError("Super Admin permissions are fixed — the last full-access role must keep them.", 400);
  }
  const before = role.permissions.map((entry) => entry.permission);
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: [...new Set(input.permissions)].map((permission) => ({ roleId, permission })),
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "ROLE_PERMISSIONS_UPDATED",
      objectType: "Role",
      objectId: roleId,
      before: { permissions: before },
      after: { permissions: [...new Set(input.permissions)] },
    });
  });
}

/** System settings (typed known keys + free-form admin additions). */
export async function listSettings() {
  return prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
}

export const UpdateSetting = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9_.]*$/),
  value: z.union([z.string().max(200), z.number(), z.boolean()]),
});

export async function updateSetting(ctx: CrmContext, input: z.infer<typeof UpdateSetting>) {
  return prisma.$transaction(async (tx) => {
    const saved = await tx.systemSetting.upsert({
      where: { key: input.key },
      create: { key: input.key, value: input.value as never, updatedById: ctx.userId },
      update: { value: input.value as never, updatedById: ctx.userId },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "SETTING_UPDATED",
      objectType: "SystemSetting",
      objectId: saved.id,
      after: { key: input.key, value: input.value },
    });
    return saved;
  });
}
