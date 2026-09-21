"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

/**
 * Status actions for the task detail page. Mirrors the TasksPage row actions
 * (PATCH /api/tasks/[id]) with the shared transition semantics: completing a
 * recurring task spawns the next occurrence server-side.
 */
export function TaskDetailActions({
  taskId,
  status,
  canEdit,
}: {
  taskId: string;
  status: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        toast.error("Task not updated", message);
        return;
      }
      toast.success(`Task ${label}`);
      window.setTimeout(() => router.refresh(), 150);
    } catch {
      setError("Could not update the task.");
      toast.error("Task not updated", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return null;
  const active = status !== "COMPLETED" && status !== "CANCELLED";

  const className = "flex items-center gap-1.5 rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:ring-offset-2 cursor-pointer";

  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      {active && status === "OPEN" ? (
        <button type="button" className={className} disabled={busy} onClick={() => void setStatus("IN_PROGRESS", "started")}>
          <Icon name="play" size={16} strokeWidth={1.5} />
          Start
        </button>
      ) : null}
      {active ? (
        <button type="button" className={className} disabled={busy} onClick={() => void setStatus("COMPLETED", "completed")}>
          <Icon name="check" size={16} strokeWidth={1.5} />
          Complete
        </button>
      ) : (
        <button type="button" className={className} disabled={busy} onClick={() => void setStatus("OPEN", "reopened")}>
          <Icon name="plus" size={16} strokeWidth={1.5} />
          Reopen
        </button>
      )}
      {active ? (
        <button
          type="button"
          className={className}
          disabled={busy}
          onClick={() => void setStatus("CANCELLED", "cancelled")}
        >
          <Icon name="close" size={16} strokeWidth={1.5} />
          Cancel task
        </button>
      ) : null}
      <Link href={`/tasks?edit=${taskId}`} className={className}>
        <Icon name="edit" size={16} strokeWidth={1.5} />
        Edit
      </Link>
      {error ? <span role="alert" className="text-xs text-(--error)">{error}</span> : null}
    </div>
  );
}
