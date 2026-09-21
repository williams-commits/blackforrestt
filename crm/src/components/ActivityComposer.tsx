"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

/**
 * Activity Composer — the compact action bar that sits above the timeline
 * on every record page (Salesforce-style). Provides one-click access to
 * the five core activity actions: Log Call (future), New Task, New Note,
 * Schedule, and Send Email.
 */
export function ActivityComposer({
  subjectType,
  subjectId,
  subjectLabel,
  canAddNote,
  canCreateTask,
  canScheduleAppointment,
}: {
  subjectType: SubjectType;
  subjectId: string;
  subjectLabel: string;
  canAddNote: boolean;
  canCreateTask: boolean;
  canScheduleAppointment: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [activeAction, setActiveAction] = useState<"none" | "note" | "task" | "appointment">("none");
  const [noteBody, setNoteBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("NORMAL");
  const [apptTitle, setApptTitle] = useState("");
  const [apptStart, setApptStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refreshAfterToast() {
    window.setTimeout(() => router.refresh(), 150);
  }

  if (!canAddNote && !canCreateTask && !canScheduleAppointment) return null;

  async function submitNote(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? "Could not save note.";
        setError(message);
        toast.error("Note not added", message);
        return;
      }
      setNoteBody("");
      setActiveAction("none");
      toast.success("Note added", `Note added to ${subjectLabel}.`);
      refreshAfterToast();
    } catch {
      setError("Could not save note.");
      toast.error("Note not added", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitTask(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, dueAt: taskDue || null, priority: taskPriority, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? "Could not create task.";
        setError(message);
        toast.error("Task not created", message);
        return;
      }
      setTaskTitle("");
      setTaskDue("");
      setTaskPriority("NORMAL");
      setActiveAction("none");
      toast.success("Task created", `Follow-up task created for ${subjectLabel}.`);
      refreshAfterToast();
    } catch {
      setError("Could not create task.");
      toast.error("Task not created", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAppointment(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: apptTitle, startAt: apptStart, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? "Could not schedule.";
        setError(message);
        toast.error("Appointment not scheduled", message);
        return;
      }
      setApptTitle("");
      setApptStart("");
      setActiveAction("none");
      toast.success("Appointment scheduled", `Appointment scheduled with ${subjectLabel}.`);
      refreshAfterToast();
    } catch {
      setError("Could not schedule appointment.");
      toast.error("Appointment not scheduled", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }


  const actions = [
    { key: "note", label: "Note", icon: "edit" },
    { key: "task", label: "Task", icon: "square_check" },
    { key: "appointment", label: "Schedule", icon: "calendar" },
  ];

  return (
    <div className="card no-print" style={{ overflow: "hidden" }}>
      {/* Action buttons row */}
      <div
        className="flex items-center gap-1 border-b px-2 py-1.5"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-subtle)" }}
      >
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          Log
        </span>
        {actions.filter((action) =>
          action.key === "note" ? canAddNote : action.key === "task" ? canCreateTask : canScheduleAppointment,
        ).map((action) => {
          const active = activeAction === action.key;
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => setActiveAction(active ? "none" : (action.key as never))}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background: active ? "var(--brand)" : "transparent",
                color: active ? "var(--text-inverse)" : "var(--text-secondary)",
              }}
            >
              <Icon name={action.icon} size={13} />
              {action.label}
            </button>
          );
        })}
      </div>

      {/* Active composer */}
      {error ? (
        <p className="px-3 py-2 text-[12px]" style={{ color: "var(--error)" }}>{error}</p>
      ) : null}

      {activeAction === "note" ? (
        <form method="post" onSubmit={submitNote} className="p-3">
          <textarea
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            placeholder={`Write a note about ${subjectLabel}…`}
            rows={2}
            required
            maxLength={5000}
            className="input"
            style={{ resize: "vertical", width: "100%" }}
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setActiveAction("none")}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !noteBody.trim()}>
              {busy ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      ) : null}

      {activeAction === "task" ? (
        <form method="post" onSubmit={submitTask} className="flex flex-col gap-2 p-3">
          <input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder={`Follow up with ${subjectLabel}…`}
            required
            minLength={2}
            className="input"
            style={{ width: "100%" }}
            autoFocus
          />
          <input
            type="datetime-local"
            value={taskDue}
            onChange={(event) => setTaskDue(event.target.value)}
            className="input"
            style={{ width: "100%" }}
          />
          <select aria-label="Task priority" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} className="input">
            <option value="LOW">Low priority</option>
            <option value="NORMAL">Normal priority</option>
            <option value="HIGH">High priority</option>
            <option value="URGENT">Urgent priority</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={busy || !taskTitle.trim()}>
            {busy ? "…" : "Add task"}
          </button>
        </form>
      ) : null}

      {activeAction === "appointment" ? (
        <form method="post" onSubmit={submitAppointment} className="flex flex-col gap-2 p-3">
          <input
            value={apptTitle}
            onChange={(event) => setApptTitle(event.target.value)}
            placeholder={`Meeting with ${subjectLabel}…`}
            required
            minLength={2}
            className="input"
            style={{ width: "100%" }}
            autoFocus
          />
          <input
            type="datetime-local"
            value={apptStart}
            onChange={(event) => setApptStart(event.target.value)}
            required
            className="input"
            style={{ width: "100%" }}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !apptTitle.trim()}>
            {busy ? "…" : "Schedule"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
