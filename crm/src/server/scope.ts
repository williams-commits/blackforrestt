import { prisma } from "@/server/db";

/**
 * Row-level data visibility, resolved centrally here and applied by every
 * list/read/write path. Never enforced in UI components.
 *
 *   OWN       → records assigned to / owned by the actor
 *   TEAM      → actor's teams (led or member)
 *   HIERARCHY → TEAM plus all descendant teams
 *   ORG       → everything
 */

export type ScopeName = "OWN" | "TEAM" | "HIERARCHY" | "ORG";

/** All teams visible to the actor under the given scope (empty = ORG). */
export async function visibleTeamIds(userId: string, scope: ScopeName): Promise<string[]> {
  if (scope === "ORG") return [];
  const [memberships, allTeams] = await Promise.all([
    prisma.teamMembership.findMany({ where: { userId }, select: { teamId: true } }),
    prisma.team.findMany({ select: { id: true, parentId: true } }),
  ]);
  const direct = new Set(memberships.map((membership) => membership.teamId));
  if (scope === "OWN") return [...direct];

  const led = await prisma.team.findMany({ where: { leaderId: userId }, select: { id: true } });
  for (const team of led) direct.add(team.id);
  if (scope === "TEAM") return [...direct];

  // HIERARCHY: expand descendants to closure.
  const childrenOf = new Map<string, string[]>();
  for (const team of allTeams) {
    if (team.parentId) {
      const list = childrenOf.get(team.parentId) ?? [];
      list.push(team.id);
      childrenOf.set(team.parentId, list);
    }
  }
  const closure = new Set(direct);
  const queue = [...direct];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!closure.has(child)) {
        closure.add(child);
        queue.push(child);
      }
    }
  }
  return [...closure];
}

/** Where-fragment for objects keyed by assignedUser/assignedTeam (leads). */
export function assignedScopeWhere(
  userId: string,
  scope: ScopeName,
  teamIds: string[],
): Record<string, unknown> {
  if (scope === "ORG") return {};
  if (scope === "OWN") return { assignedUserId: userId };
  return { OR: [{ assignedUserId: userId }, { assignedTeamId: { in: teamIds } }] };
}

/** Where-fragment for objects keyed by owner/team (contacts, accounts, customers). */
export function ownerScopeWhere(
  userId: string,
  scope: ScopeName,
  teamIds: string[],
): Record<string, unknown> {
  if (scope === "ORG") return {};
  if (scope === "OWN") return { ownerUserId: userId };
  return { OR: [{ ownerUserId: userId }, { teamId: { in: teamIds } }] };
}
