import { RolesTab } from "@/components/AdminConsole";
import { requirePermission } from "@/server/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Roles" };

export default async function AdminRolesPage() {
  let canManage = false;
  try {
    await requirePermission("ROLES_MANAGE");
    canManage = true;
  } catch {
    canManage = false;
  }
  return <RolesTab canManage={canManage} />;
}
