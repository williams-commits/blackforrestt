import { StatusesTab } from "@/components/AdminConsole";
import { requirePermission } from "@/server/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Statuses" };

export default async function AdminStatusesPage() {
  let canManage = false;
  try {
    await requirePermission("RECORD_STATUS_CREATE");
    canManage = true;
  } catch {
    // The page remains readable; mutation controls stay hidden.
  }
  return <StatusesTab canManage={canManage} />;
}
