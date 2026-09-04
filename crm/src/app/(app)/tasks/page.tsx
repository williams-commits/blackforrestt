import { Suspense } from "react";
import { TasksPage } from "@/components/TasksPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tasks" };

export default function TasksRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-tertiary)]">Loading tasks…</p>}>
      <TasksPage />
    </Suspense>
  );
}
