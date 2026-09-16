"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      {active && status === "OPEN" ? (
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void setStatus("IN_PROGRESS", "started")}>
          Start
        </button>
      ) : null}
      {active ? (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void setStatus("COMPLETED", "completed")}>
          Complete
        </button>
      ) : (
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void setStatus("OPEN", "reopened")}>
          Reopen
        </button>
      )}
      {active ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void setStatus("CANCELLED", "cancelled")}
        >
          Cancel task
        </button>
      ) : null}
      <Link href={`/tasks?edit=${taskId}`} className="btn btn-ghost">
        Edit
      </Link>
      {error ? <span role="alert" className="text-xs text-(--error)">{error}</span> : null}
    </div>
  );
}
