"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  canEdit,
}: {
  subjectType: SubjectType;
  subjectId: string;
  subjectLabel: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<"none" | "note" | "task" | "appointment">("none");
  const [noteBody, setNoteBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [apptTitle, setApptTitle] = useState("");
  const [apptStart, setApptStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

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
        setError(body?.error ?? "Could not save note.");
        return;
      }
      setNoteBody("");
      setActiveAction("none");
      router.refresh();
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
        body: JSON.stringify({ title: taskTitle, dueAt: taskDue || null, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not create task.");
        return;
      }
      setTaskTitle("");
      setTaskDue("");
      setActiveAction("none");
      router.refresh();
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
        setError(body?.error ?? "Could not schedule.");
        return;
      }
      setApptTitle("");
      setApptStart("");
      setActiveAction("none");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const actions = [
    { key: "note", label: "Note", icon: "M12 20h9", sub: "M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" },
    { key: "task", label: "Task", icon: "M9 11l3 3L22 4", sub: "M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
    { key: "appointment", label: "Schedule", icon: "M12 2v4m0 16v4M4.93 4.93l2.83 2.83m9.9 9.9l2.83 2.83M2 12h4m16 0h-4", sub: "" },
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
        {actions.map((action) => {
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={action.icon} />
                {action.sub ? <path d={action.sub} /> : null}
              </svg>
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
            style={{ resize: "vertical" }}
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
        <form method="post" onSubmit={submitTask} className="grid gap-2 p-3 sm:grid-cols-[1fr_180px_auto]">
          <input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder={`Follow up with ${subjectLabel}…`}
            required
            minLength={2}
            className="input"
            autoFocus
          />
          <input
            type="datetime-local"
            value={taskDue}
            onChange={(event) => setTaskDue(event.target.value)}
            className="input"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !taskTitle.trim()}>
            {busy ? "…" : "Add task"}
          </button>
        </form>
      ) : null}

      {activeAction === "appointment" ? (
        <form method="post" onSubmit={submitAppointment} className="grid gap-2 p-3 sm:grid-cols-[1fr_180px_auto]">
          <input
            value={apptTitle}
            onChange={(event) => setApptTitle(event.target.value)}
            placeholder={`Meeting with ${subjectLabel}…`}
            required
            minLength={2}
            className="input"
            autoFocus
          />
          <input
            type="datetime-local"
            value={apptStart}
            onChange={(event) => setApptStart(event.target.value)}
            required
            className="input"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !apptTitle.trim()}>
            {busy ? "…" : "Schedule"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
