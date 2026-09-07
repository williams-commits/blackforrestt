"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export interface SubjectNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
}

export interface SubjectAppointment {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  status: string;
  locationOrLink: string | null;
}

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

/**
 * Record-scoped activity panel: add a note, create a follow-up task, or
 * schedule an appointment — all attached to the record via subject refs
 * (scope-validated server-side).
 */
export function RecordActivities({
  subjectType,
  subjectId,
  subjectLabel,
  notes,
  appointments,
  canAddNote,
  canCreateTask,
  canScheduleAppointment,
}: {
  subjectType: SubjectType;
  subjectId: string;
  subjectLabel: string;
  notes: SubjectNote[];
  appointments: SubjectAppointment[];
  canAddNote: boolean;
  canCreateTask: boolean;
  canScheduleAppointment: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [noteBody, setNoteBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTask, setShowTask] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [taskTitle, setTaskTitle] = useState(`Follow up: ${subjectLabel}`);
  const [taskDue, setTaskDue] = useState("");
  const [apptTitle, setApptTitle] = useState(`Meeting: ${subjectLabel}`);
  const [apptStart, setApptStart] = useState("");
  const [apptLocation, setApptLocation] = useState("");

  const inputClass =
    "w-full rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none";

  function refreshAfterToast() {
    window.setTimeout(() => router.refresh(), 150);
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? "Could not add note.";
        setError(message);
        toast.error("Note not added", message);
        return;
      }
      setNoteBody("");
      toast.success("Note added", `Note added to ${subjectLabel}.`);
      refreshAfterToast();
    } catch {
      setError("Could not add note.");
      toast.error("Note not added", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, dueAt: taskDue || null, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? "Could not create task.";
        setError(message);
        toast.error("Task not created", message);
        return;
      }
      setShowTask(false);
      toast.success("Task created", `Follow-up task created for ${subjectLabel}.`);
      refreshAfterToast();
    } catch {
      setError("Could not create task.");
      toast.error("Task not created", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function scheduleAppointment(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: apptTitle, startAt: apptStart, locationOrLink: apptLocation || null, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? "Could not schedule appointment.";
        setError(message);
        toast.error("Appointment not scheduled", message);
        return;
      }
      setShowAppointment(false);
      toast.success("Appointment scheduled", `Appointment scheduled with ${subjectLabel}.`);
      refreshAfterToast();
    } catch {
      setError("Could not schedule appointment.");
      toast.error("Appointment not scheduled", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
          {error}
        </p>
      ) : null}

      {canAddNote || canCreateTask || canScheduleAppointment ? (
        <>
          {canAddNote ? <form method="post" onSubmit={addNote} className="space-y-2">
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Add a note…"
              aria-label="New note"
              rows={2}
              required
              maxLength={5000}
              className={inputClass}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="btn btn-secondary"
              >
                {busy ? "Adding…" : "Add note"}
              </button>
            </div>
          </form> : null}

          <div className="flex gap-2">
            {canCreateTask ? <button
              type="button"
              onClick={() => {
                setShowTask((previous) => !previous);
                setShowAppointment(false);
              }}
              className="btn btn-secondary"
            >
              Create follow-up task
            </button> : null}
            {canScheduleAppointment ? <button
              type="button"
              onClick={() => {
                setShowAppointment((previous) => !previous);
                setShowTask(false);
              }}
              className="btn btn-secondary"
            >
              Schedule appointment
            </button> : null}
          </div>

          {canCreateTask && showTask ? (
            <form method="post" onSubmit={createTask} className="grid gap-2 rounded-md border border-(--border-default) p-3 sm:grid-cols-3">
              <input
                aria-label="Task title"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                required
                minLength={2}
                className={inputClass}
              />
              <input
                aria-label="Task due"
                type="datetime-local"
                value={taskDue}
                onChange={(event) => setTaskDue(event.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: "var(--brand)" }}
              >
                Create
              </button>
            </form>
          ) : null}

          {canScheduleAppointment && showAppointment ? (
            <form method="post" onSubmit={scheduleAppointment} className="grid gap-2 rounded-md border border-(--border-default) p-3 sm:grid-cols-4">
              <input
                aria-label="Appointment title"
                value={apptTitle}
                onChange={(event) => setApptTitle(event.target.value)}
                required
                minLength={2}
                className={inputClass}
              />
              <input
                aria-label="Starts at"
                type="datetime-local"
                value={apptStart}
                onChange={(event) => setApptStart(event.target.value)}
                required
                className={inputClass}
              />
              <input
                aria-label="Location or link"
                value={apptLocation}
                onChange={(event) => setApptLocation(event.target.value)}
                placeholder="Zoom, office…"
                className={inputClass}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: "var(--brand)" }}
              >
                Schedule
              </button>
            </form>
          ) : null}
        </>
      ) : null}

      {appointments.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--text-tertiary)">
            Appointments
          </h3>
          <ul className="space-y-1">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{appointment.title}</span>
                <span className="text-(--text-secondary)">
                  {new Date(appointment.startAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {appointment.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--text-tertiary)">
          Notes ({notes.length})
        </h3>
        {notes.length === 0 ? (
          <p className="text-sm text-(--text-tertiary)">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border border-(--border-default) bg-(--bg-hover) p-3 text-sm">
                <p className="whitespace-pre-wrap">{note.body}</p>
                <p className="mt-1 text-xs text-(--text-tertiary)">
                  {note.author.name} ·{" "}
                  {new Date(note.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
