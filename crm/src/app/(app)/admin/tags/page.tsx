import { TagsTab } from "@/components/AdminConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Tags" };

export default function AdminTagsPage() {
  return <TagsTab canManage={true} />;
}
