import { auth } from "@/auth";
import { prisma } from "@/server/db";
import type { Permission } from "@/server/permissions";

/** Authorization/domain error carrying an HTTP-compatible status and,
 *  optionally, structured details (e.g. duplicate matches for 409s). */
export class CrmError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CrmError";
  }
}

export interface CrmContext {
  userId: string;
  name: string;
  roleKey: string;
  scope: "OWN" | "TEAM" | "HIERARCHY" | "ORG";
  permissions: Permission[];
}

/**
 * Resolve the authenticated CRM user and enforce a permission server-side.
 * Every API route handler calls this first; UI never decides authorization.
 */
export async function requirePermission(permission: Permission): Promise<CrmContext> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new CrmError("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      status: true,
      role: { select: { key: true, scope: true, permissions: { select: { permission: true } } } },
    },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new CrmError("Forbidden — an active CRM account is required", 403);
  }

  const permissions = user.role.permissions.map((entry) => entry.permission) as Permission[];
  if (!permissions.includes(permission)) {
    throw new CrmError(`Forbidden — ${permission} permission required`, 403);
  }

  return { userId, name: user.name, roleKey: user.role.key, scope: user.role.scope, permissions };
}

/** Enforce several permissions at once (all must be held). */
export async function requirePermissions(...required: Permission[]): Promise<CrmContext> {
  let context: CrmContext | null = null;
  for (const permission of required) {
    context = await requirePermission(permission);
  }
  return context as CrmContext;
}
