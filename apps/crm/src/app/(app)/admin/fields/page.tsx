import { FieldsTab } from "@/components/AdminConsole";
import { requirePermission } from "@/server/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Fields" };

export default async function AdminFieldsPage() {
  let canManage = false;
  try {
    await requirePermission("SETTINGS_MANAGE");
    canManage = true;
  } catch {
    canManage = false;
  }
  return <FieldsTab canManage={canManage} />;
}
