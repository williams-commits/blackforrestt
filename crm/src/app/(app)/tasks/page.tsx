import { RecordListPage } from "@/components/RecordListPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tasks" };

/** Tasks run on the shared object-home table (same engine as leads). */
export default function TasksRoutePage() {
  return <RecordListPage object="tasks" />;
}
