import { RecordListPage } from "@/components/RecordListPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Customers" };

export default function CustomersPage() {
  return <RecordListPage object="customers" />;
}
