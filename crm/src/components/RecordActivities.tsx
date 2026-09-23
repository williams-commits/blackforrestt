"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CommentsSection } from "@/components/CommentsSection";
import { Initials } from "@/components/Initials";
import { Button } from "@/components/ui";
import { Field, IconInput } from "@/components/form";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icon } from "./Icon";

/** Compact semantic chip for a raw status string (task/apointment states). */
function StatusChip({ value }: { value: string }) {
  const normalized = value.toLowerCase().replace(/_/g, " ");
  const cls = normalized.includes("complet")
    ? "badge badge-success"
    : normalized.includes("cancel")
      ? "badge badge-error"
      : "badge badge-neutral";
  return <span className={`${cls} tabular-nums`}>{normalized}</span>;
}

/** Inline empty-state for the activity sub-lists. */
function EmptyHint({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
      <Icon name={icon} size={15} className="shrink-0 text-muted-foreground/60" />
      {text}
    </div>
  );
}

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

interface SubjectTask {
  id: string;
  title: string;
  dueAt: string | null;
  priority: string;
  status: string;
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
  const [noteBody, setNoteBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTask, setShowTask] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [activeTab, setActiveTab] = useState<"notes" | "tasks" | "appointments">("notes");
  const [tasks, setTasks] = useState<SubjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskTitle, setTaskTitle] = useState(`Follow up: ${subjectLabel}`);
  const [taskDue, setTaskDue] = useState("");
  const [apptTitle, setApptTitle] = useState(`Meeting: ${subjectLabel}`);
  const [apptStart, setApptStart] = useState("");
  const [apptLocation, setApptLocation] = useState("");
  // Comment capabilities resolve per user (client fetch — same as RecordListPage).
  const [me, setMe] = useState<{ userId: string; canComment: boolean; canManage: boolean } | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/me");
        const body = (await response.json().catch(() => null)) as {
          data?: { userId: string; permissions?: string[] };
        } | null;
        if (cancelled || !response.ok || !body?.data) return;
        const permissions = body.data.permissions ?? [];
        setMe({
          userId: body.data.userId,
          canComment: permissions.includes("COMMENTS_CREATE"),
          canManage: permissions.includes("COMMENTS_MANAGE"),
        });
      } catch {
        // Comment affordance stays hidden — the server still enforces authz.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleComments = useCallback((id: string) => {
    setOpenComments((previous) => ({ ...previous, [id]: !previous[id] }));
  }, []);

  function refreshAfterToast() {
    window.setTimeout(() => router.refresh(), 150);
  }

  async function loadTasks() {
    setTasksLoading(true);
    try {
      const response = await fetch(`/api/tasks?subjectType=${subjectType}&subjectId=${subjectId}&mine=0&due=all&pageSize=50`);
      const body = await response.json().catch(() => null) as { data?: SubjectTask[] } | null;
      setTasks(response.ok ? body?.data ?? [] : []);
    } finally {
      setTasksLoading(false);
    }
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
        toast.error("Note not added", { description: message });
        return;
      }
      setNoteBody("");
      toast.success("Note added", { description: `Note added to ${subjectLabel}.` });
      refreshAfterToast();
    } catch {
      setError("Could not add note.");
      toast.error("Note not added", { description: "Check your connection and try again." });
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
        toast.error("Task not created", { description: message });
        return;
      }
      setShowTask(false);
      toast.success("Task created", { description: `Follow-up task created for ${subjectLabel}.` });
      refreshAfterToast();
    } catch {
      setError("Could not create task.");
      toast.error("Task not created", { description: "Check your connection and try again." });
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
        toast.error("Appointment not scheduled", { description: message });
        return;
      }
      setShowAppointment(false);
      toast.success("Appointment scheduled", { description: `Appointment scheduled with ${subjectLabel}.` });
      refreshAfterToast();
    } catch {
      setError("Could not schedule appointment.");
      toast.error("Appointment not scheduled", { description: "Check your connection and try again." });
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
            <div>
              <p className="form-section-title">Note</p>
              <p className="form-section-help">Context for everyone working this record — visible on the timeline.</p>
            </div>
            <Textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Add a note — context, decisions, next steps…"
              aria-label="New note"
              rows={2}
              required
              maxLength={5000}
              className="resize-y"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-(--text-tertiary)">{noteBody.length.toLocaleString()} / 5,000</p>
              <Button
                type="submit"
                variant="primary"
                icon="note"
                loading={busy}
                disabled={!noteBody.trim()}
              >
                Add note
              </Button>
            </div>
          </form> : null}

          <div className="flex flex-wrap gap-2">
            {canCreateTask ? <Button
              variant={showTask ? "primary" : "secondary"}
              icon="square_check"
              onClick={() => {
                setShowTask((previous) => !previous);
                setShowAppointment(false);
              }}
              aria-pressed={showTask}
            >
              {showTask ? "Hide task form" : "Create follow-up task"}
            </Button> : null}
            {canScheduleAppointment ? <Button
              variant={showAppointment ? "primary" : "secondary"}
              icon="calendar"
              onClick={() => {
                setShowAppointment((previous) => !previous);
                setShowTask(false);
              }}
              aria-pressed={showAppointment}
            >
              {showAppointment ? "Hide schedule form" : "Schedule appointment"}
            </Button> : null}
          </div>

          {canCreateTask && showTask ? (
            <form method="post" onSubmit={createTask} className="space-y-3 rounded-md border border-(--border-default) p-3">
              <div>
                <p className="form-section-title">Follow-up task</p>
                <p className="form-section-help">Linked to this record — appears on its timeline and your queue.</p>
              </div>
              <Field label="What needs to happen" required id="ra-task-title">
                <IconInput
                  id="ra-task-title"
                  icon="square_check"
                  aria-label="Task title"
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="e.g. Send the revised proposal"
                  required
                  minLength={2}
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Due" id="ra-task-due">
                  <IconInput
                    id="ra-task-due"
                    icon="calendar"
                    aria-label="Task due"
                    type="datetime-local"
                    value={taskDue}
                    onChange={(event) => setTaskDue(event.target.value)}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    variant="primary"
                    icon="plus"
                    loading={busy}
                    disabled={!taskTitle.trim()}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </form>
          ) : null}

          {canScheduleAppointment && showAppointment ? (
            <form method="post" onSubmit={scheduleAppointment} className="space-y-3 rounded-md border border-(--border-default) p-3">
              <div>
                <p className="form-section-title">Schedule</p>
                <p className="form-section-help">Logged on the activity timeline for this record.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="What" required id="ra-appt-title">
                  <IconInput
                    id="ra-appt-title"
                    icon="calendar"
                    aria-label="Appointment title"
                    value={apptTitle}
                    onChange={(event) => setApptTitle(event.target.value)}
                    placeholder="e.g. Onboarding call"
                    required
                    minLength={2}
                  />
                </Field>
                <Field label="Starts" required id="ra-appt-start">
                  <IconInput
                    id="ra-appt-start"
                    icon="clock"
                    aria-label="Starts at"
                    type="datetime-local"
                    value={apptStart}
                    onChange={(event) => setApptStart(event.target.value)}
                    required
                  />
                </Field>
              </div>
              <Field label="Location or link" id="ra-appt-location" help="Where it happens — a room, a Zoom link, a phone number.">
                <IconInput
                  id="ra-appt-location"
                  icon="map_pin"
                  aria-label="Location or link"
                  value={apptLocation}
                  onChange={(event) => setApptLocation(event.target.value)}
                  placeholder="e.g. Zoom — link in the invite"
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  icon="calendar"
                  loading={busy}
                  disabled={!apptTitle.trim() || !apptStart}
                >
                  Schedule
                </Button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-(--border-default)">
        <Tabs
          value={activeTab}
          onValueChange={(key) => {
            const next = key as typeof activeTab;
            setActiveTab(next);
            if (next === "tasks" && tasks.length === 0) void loadTasks();
          }}
        >
          <div className="border-b border-(--border-default) bg-(--bg-subtle)">
            <TabsList
              variant="line"
              aria-label="Related activity"
              className="h-auto w-full justify-stretch gap-0 p-0"
            >
            {[{ key: "notes" as const, label: "Notes", icon: "note", count: notes.length }, { key: "tasks" as const, label: "Tasks", icon: "square_check", count: tasks.length }, { key: "appointments" as const, label: "Schedule", icon: "calendar", count: appointments.length }].map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex-1 justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
              >
                <Icon name={tab.icon} size={13} />
                {tab.label}
                {tab.count > 0 ? (
                  <span className="rounded-full bg-(--gray-100) px-1.5 text-[10px] font-semibold tabular-nums text-(--text-secondary)">{tab.count}</span>
                ) : null}
              </TabsTrigger>
            ))}
            </TabsList>
          </div>
        </Tabs>
        <div className="p-3">
          {activeTab === "notes" ? notes.length === 0 ? <EmptyHint icon="note" text="No notes yet — add context for everyone working this record." /> : <ul className="space-y-2">{notes.map((note) => (
          <li key={note.id} className="rounded-md border border-border bg-muted/40 p-3 text-sm transition-colors hover:bg-muted/70">
            <div className="flex items-start gap-2.5">
              <Initials name={note.author.name} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-semibold text-foreground">{note.author.name}</span>
                  <time className="text-[11px] text-muted-foreground" dateTime={note.createdAt}>
                    {new Date(note.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap wrap-break-words text-[13px] leading-relaxed text-foreground">{note.body}</p>
              </div>
            </div>
            <div className="mt-2 flex justify-end border-t border-border pt-1.5">
              <button type="button" onClick={() => toggleComments(note.id)} className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Icon name="note" size={12} />
                {openComments[note.id] ? "Hide comments" : "Comments"}
              </button>
            </div>
            {openComments[note.id] && me ? (
              <div className="mt-2 border-t border-border pt-2">
                <CommentsSection subjectType="NOTE" subjectId={note.id} initial={[]} canComment={me.canComment} canManage={me.canManage} currentUserId={me.userId} compact lazyMount />
              </div>
            ) : null}
          </li>))}</ul> : null}
          {activeTab === "tasks" ? tasksLoading ? <Skeleton className="h-12 w-full" /> : tasks.length === 0 ? <EmptyHint icon="square_check" text="No related tasks yet — create a follow-up above." /> : <ul className="space-y-2">{tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Icon name="square_check" size={15} className="shrink-0 text-muted-foreground" />
              <Link href={`/tasks/${task.id}`} className="min-w-0 truncate font-medium text-primary hover:underline">{task.title}</Link>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {task.dueAt ? (
                <span className="badge badge-neutral gap-1"><Icon name="calendar" size={11} />{new Date(task.dueAt).toLocaleDateString()}</span>
              ) : (
                <span className="text-xs text-muted-foreground">No due date</span>
              )}
              <StatusChip value={task.status} />
            </span>
          </li>))}</ul> : null}
          {activeTab === "appointments" ? appointments.length === 0 ? <EmptyHint icon="calendar" text="No appointments yet — schedule one above." /> : <ul className="space-y-2">{appointments.map((appointment) => (
          <li key={appointment.id} className="rounded-md border border-border p-3 text-sm transition-colors hover:bg-muted/50">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <Icon name="calendar" size={15} className="shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">{appointment.title}</span>
              </span>
              <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{new Date(appointment.startAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                <StatusChip value={appointment.status} />
              </span>
            </div>
            {appointment.locationOrLink ? (
              <p className="mt-1.5 flex items-center gap-1.5 pl-5.75 text-xs text-muted-foreground">
                <Icon name="map_pin" size={11} className="shrink-0" />
                <span className="truncate">{appointment.locationOrLink}</span>
              </p>
            ) : null}
            <div className="mt-2 flex justify-end border-t border-border pt-1.5">
              <button type="button" onClick={() => toggleComments(appointment.id)} className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Icon name="note" size={12} />
                {openComments[appointment.id] ? "Hide comments" : "Comments"}
              </button>
            </div>
            {openComments[appointment.id] && me ? (
              <div className="mt-2 border-t border-border pt-2">
                <CommentsSection subjectType="APPOINTMENT" subjectId={appointment.id} initial={[]} canComment={me.canComment} canManage={me.canManage} currentUserId={me.userId} compact lazyMount />
              </div>
            ) : null}
          </li>))}</ul> : null}
        </div>
      </div>
    </div>
  );
}
