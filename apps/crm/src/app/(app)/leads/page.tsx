import { RecordListPage } from "@/components/RecordListPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leads" };

export default function LeadsPage() {
  return <RecordListPage object="leads" />;
}
