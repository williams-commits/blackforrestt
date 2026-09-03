import { RecordListPage } from "@/components/RecordListPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Accounts" };

export default function AccountsPage() {
  return <RecordListPage object="accounts" />;
}
