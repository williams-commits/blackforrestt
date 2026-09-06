import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";

/** Only frontline/management staff may own CRM records. */
const ASSIGNABLE_ROLE_KEYS = ["MANAGER", "TEAM_LEAD", "REP", "VIEWER"];

export async function assertAssignableUser(userId: string | null | undefined): Promise<void> {
  if (!userId) return; // Leads may intentionally be left unassigned.
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE", role: { key: { in: ASSIGNABLE_ROLE_KEYS } } },
    select: { id: true },
  });
  if (!user) {
    throw new CrmError("Records can only be assigned to an active Manager, Team Lead, Rep, or Viewer.", 400);
  }
}
