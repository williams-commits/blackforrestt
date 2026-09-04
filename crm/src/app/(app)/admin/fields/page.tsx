import { FieldsTab } from "@/components/AdminConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Fields" };

export default function AdminFieldsPage() {
  return <FieldsTab canManage={true} />;
}
