import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { logger } from "@/server/observability";
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
  /** Client IP stamped by middleware — flows into audit entries. */
  ip: string | null;
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
    logger.warn("authz_inactive_or_unknown_user", { userId, ip: (await headers()).get("x-client-ip") });
    throw new CrmError("Forbidden — an active CRM account is required", 403);
  }

  const permissions = user.role.permissions.map((entry) => entry.permission) as Permission[];
  const ip = (await headers()).get("x-client-ip");
  if (!permissions.includes(permission)) {
    // Authorization failures are security signals — always logged.
    logger.warn("authz_denied", { userId, permission, ip });
    throw new CrmError(`Forbidden — ${permission} permission required`, 403);
  }

  return { userId, name: user.name, roleKey: user.role.key, scope: user.role.scope, permissions, ip };
}

/** Enforce several permissions at once (all must be held). */
export async function requirePermissions(...required: Permission[]): Promise<CrmContext> {
  let context: CrmContext | null = null;
  for (const permission of required) {
    context = await requirePermission(permission);
  }
  return context as CrmContext;
}
