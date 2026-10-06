"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RowActions } from "@/components/RowActions";
import { RecordForm, type OptionSource } from "@/components/RecordForm";
import { RECORD_UI } from "@/lib/recordUi";

/**
 * Status actions for the task detail page. Mirrors the TasksPage row actions
 * (PATCH /api/tasks/[id]) with the shared transition semantics: completing a
 * recurring task spawns the next occurrence server-side.
 */
export function TaskDetailActions({
  taskId,
  status,
  canEdit,
  task,
}: {
  taskId: string;
  status: string;
  canEdit: boolean;
  /** Full task row — feeds the in-place edit drawer. */
  task: {
    id: string;
    title: string;
    description: string | null;
    dueAt: string | Date | null;
    priority: string;
    recurrence: string;
    reminderAt: string | Date | null;
    ownerUserId: string | null;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [userOptions, setUserOptions] = useState<Array<{ value: string; label: string }> | null>(null);

  function openEdit() {
    // Owner select options load once, on first open.
    if (userOptions === null) {
      setUserOptions([]); // placeholder while loading — avoids refetch loops
      void fetch("/api/users")
        .then((response) => (response.ok ? response.json() : { data: [] }))
        .then((body) => {
          const users = ((body?.data ?? []) as Array<{ id: string; name: string }>).map((user) => ({
            value: user.id,
            label: user.name,
          }));
          setUserOptions(users);
        })
        .catch(() => setUserOptions([]));
    }
    setEditing(true);
  }

  const emptyOptions: OptionSource = {
    leadStatuses: [],
    accountStatuses: [],
    potentialStatuses: [],
    contactStatuses: [],
    customerStatuses: [],
    accounts: [],
    contacts: [],
    campaigns: [],
    users: userOptions ?? [],
  };

  async function setStatus(next: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED", label: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = payload?.error ?? "Could not update the task.";
        setError(message);
        toast.error("Task not updated", { description: message });
        return;
      }
      toast.success(`Task ${label}`);
      window.setTimeout(() => router.refresh(), 150);
    } catch {
      setError("Could not update the task.");
      toast.error("Task not updated", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return null;
  const active = status !== "COMPLETED" && status !== "CANCELLED";

  const actions = [
    ...(active && status === "OPEN"
      ? [{ label: "Start", icon: "play", onClick: () => void setStatus("IN_PROGRESS", "started") }]
      : []),
    ...(active
      ? [{ label: "Complete", icon: "check", onClick: () => void setStatus("COMPLETED", "completed") }]
      : [{ label: "Reopen", icon: "plus", onClick: () => void setStatus("OPEN", "reopened") }]),
    { label: "Edit", icon: "edit", onClick: openEdit },
    ...(active
      ? [{ label: "Cancel task", icon: "close", destructive: true, onClick: () => void setStatus("CANCELLED", "cancelled") }]
      : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      <RowActions actions={actions} />
      {error ? <span role="alert" className="text-xs text-(--error)">{error}</span> : null}

      {editing ? (
        <RecordForm
          object="tasks"
          fields={RECORD_UI.tasks.fields}
          options={emptyOptions}
          initial={task}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
