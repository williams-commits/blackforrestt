import { StatusesTab } from "@/components/AdminConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Statuses" };

export default function AdminStatusesPage() {
  return <StatusesTab canManage={true} />;
}
