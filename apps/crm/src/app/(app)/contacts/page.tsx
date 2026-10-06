import { RecordListPage } from "@/components/RecordListPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contacts" };

export default function ContactsPage() {
  return <RecordListPage object="contacts" />;
}
