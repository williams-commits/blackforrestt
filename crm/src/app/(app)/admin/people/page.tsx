import { PeopleTab } from "@/components/AdminConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — People" };

export default function AdminPeoplePage() {
  return <PeopleTab canManage={true} />;
}
