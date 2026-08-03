import type { AdminRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import {
  permissionsForRoles,
  type AdminPermission,
} from "@/server/adminPolicy";

export {
  canReviewChangeDomain,
  hasAdminPermission,
  permissionsForRoles,
  type AdminChangeDomainName,
  type AdminPermission,
  type AdminRoleName,
} from "@/server/adminPolicy";

export interface AdminContext {
  actorId: string;
  roles: AdminRole[];
  permissions: AdminPermission[];
  legacySuperAdmin: boolean;
}

/** Resolve a real authenticated administrative identity and its active roles. */
export async function requireAdminContext(
  permission: AdminPermission = "ADMIN_DASHBOARD",
): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) throw new AdminError("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isAdmin: true,
      adminRoles: {
        where: { revokedAt: null },
        select: { role: true },
      },
    },
  });
  if (!user) throw new AdminError("Unauthorized", 401);

  // Legacy fallback exists only during migration. The Phase 6 migration creates
  // an explicit SUPER_ADMIN assignment for every legacy administrator.
  const legacySuperAdmin = user.isAdmin && user.adminRoles.length === 0;
  const roles = legacySuperAdmin
    ? (["SUPER_ADMIN"] as AdminRole[])
    : user.adminRoles.map((assignment) => assignment.role);
  if (roles.length === 0) {
    throw new AdminError("Forbidden — an active administrative role is required", 403);
  }

  const permissions = permissionsForRoles(roles);
  if (!permissions.includes(permission)) {
    throw new AdminError(`Forbidden — ${permission} permission required`, 403);
  }

  return { actorId: session.user.id, roles, permissions, legacySuperAdmin };
}

/** Compatibility helper for handlers that only need the authorized actor ID. */
export async function requireAdmin(
  permission: AdminPermission = "ADMIN_DASHBOARD",
): Promise<string> {
  return (await requireAdminContext(permission)).actorId;
}

/** Role-specific authorization error with an HTTP-compatible status. */
export class AdminError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AdminError";
  }
}
