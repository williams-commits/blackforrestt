import { PeopleTab } from "@/components/AdminConsole";
import { requireAnyPermission } from "@/server/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — People" };

export default async function AdminPeoplePage() {
  // View comes from the layout gate (ADMIN_ACCESS); mutations need the real
  // management permissions.
  let canManage = false;
  try {
    await requireAnyPermission("USERS_MANAGE", "TEAMS_MANAGE");
    canManage = true;
  } catch {
    canManage = false;
  }
  return <PeopleTab canManage={canManage} />;
}
