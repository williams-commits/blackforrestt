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

  const className = "flex items-center gap-1.5 rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:ring-offset-2 cursor-pointer";

  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      {active && status === "OPEN" ? (
        <button type="button" className={className} disabled={busy} onClick={() => void setStatus("IN_PROGRESS", "started")}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
          Start
        </button>
      ) : null}
      {active ? (
        <button type="button" className={className} disabled={busy} onClick={() => void setStatus("COMPLETED", "completed")}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Complete
        </button>
      ) : (
        <button type="button" className={className} disabled={busy} onClick={() => void setStatus("OPEN", "reopened")}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel task
        </button>
      ) : null}
      <Link href={`/tasks?edit=${taskId}`} className={className}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </Link>
      {error ? <span role="alert" className="text-xs text-(--error)">{error}</span> : null}
    </div>
  );
}
