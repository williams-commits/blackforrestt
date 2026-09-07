import { TagsTab } from "@/components/AdminConsole";
import { requirePermission } from "@/server/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Tags" };

export default async function AdminTagsPage() {
  let canManage = false;
  try {
    await requirePermission("TAGS_CREATE");
    canManage = true;
  } catch {
    // The page remains readable; mutation controls stay hidden.
  }
  return <TagsTab canManage={canManage} />;
}
