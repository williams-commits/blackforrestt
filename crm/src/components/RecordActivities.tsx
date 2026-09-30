"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CommentsSection } from "@/components/CommentsSection";
import { Initials } from "@/components/Initials";
import { Button } from "@/components/ui";
import { Field, IconInput } from "@/components/form";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/RichTextEditor";
import { EmptyState } from "@/components/ui/empty-state";
import { relativeTime, absoluteTime } from "@/lib/time";
import { renderRichText } from "@/lib/richText";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icon } from "@/components/Icon";

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

/** Inline empty-state for the activity sub-lists — renders through the
 * shared EmptyState primitive (left-aligned compact variant). */
function EmptyHint({ icon, text }: { icon: string; text: string }) {
  return <EmptyState icon={icon} iconTile={false} title={text} className="justify-start py-4 text-left" />;
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
  const noteFormRef = useRef<HTMLFormElement>(null);
  const noteEditorRef = useRef<RichTextEditorHandle>(null);
  const noteBusyRef = useRef(false); // synchronous — ⌘/Ctrl+Enter can double-fire within one render
  const [noteText, setNoteText] = useState("");
  const [noteHtml, setNoteHtml] = useState("");
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
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // Batch comment-count badges for the visible work items (notes,
  // appointments, loaded tasks). Re-runs on the realtime refresh so other
  // users' comments bump the badges live.
  const refreshCommentCounts = useCallback(async () => {
    const groups = [
      { type: "NOTE" as const, ids: notes.map((note) => note.id) },
      { type: "APPOINTMENT" as const, ids: appointments.map((appointment) => appointment.id) },
      { type: "TASK" as const, ids: tasks.map((task) => task.id) },
    ];
    for (const group of groups) {
      if (group.ids.length === 0) continue;
      const ids = group.ids.slice(0, 100).join(",");
      try {
        const response = await fetch(`/api/comments/counts?subjectType=${group.type}&ids=${ids}`);
        if (!response.ok) continue;
        const payload = (await response.json().catch(() => null)) as { data?: Record<string, number> } | null;
        if (payload?.data) setCommentCounts((current) => ({ ...current, ...payload.data }));
      } catch { /* badges are best-effort */ }
    }
  }, [notes, appointments, tasks]);

  useEffect(() => {
    void refreshCommentCounts();
    const onRealtime = () => void refreshCommentCounts();
    window.addEventListener("crm:realtime-refresh", onRealtime);
    return () => window.removeEventListener("crm:realtime-refresh", onRealtime);
  }, [refreshCommentCounts]);

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
    if (noteBusyRef.current) return;
    noteBusyRef.current = true;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteHtml, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? "Could not add note.";
        setError(message);
        toast.error("Note not added", { description: message });
        return;
      }
      noteEditorRef.current?.clear();
      toast.success("Note added", { description: `Note added to ${subjectLabel}.` });
      refreshAfterToast();
    } catch {
      setError("Could not add note.");
      toast.error("Note not added", { description: "Check your connection and try again." });
    } finally {
      noteBusyRef.current = false;
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
          {canAddNote ? <form ref={noteFormRef} method="post" onSubmit={addNote} className="space-y-2">
            <div>
              <p className="form-section-title">Note</p>
              <p className="form-section-help">Context for everyone working this record — visible on the timeline.</p>
            </div>
            <RichTextEditor
              ref={noteEditorRef}
              ariaLabel="New note"
              placeholder="Add a note — context, decisions, next steps…"
              maxLength={5000}
              minHeight={64}
              disabled={busy}
              onSubmit={() => noteFormRef.current?.requestSubmit()}
              onChange={(text, html) => { setNoteText(text); setNoteHtml(html); }}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="submit"
                variant="primary"
                icon="note"
                loading={busy}
                disabled={!noteText.trim()}
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
            <form method="post" onSubmit={createTask} className="space-y-3 rounded-md border border-border p-3">
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
            <form method="post" onSubmit={scheduleAppointment} className="space-y-3 rounded-md border border-border p-3">
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

      <div className="overflow-hidden rounded-lg border border-border">
        <Tabs
          value={activeTab}
          onValueChange={(key) => {
            const next = key as typeof activeTab;
            setActiveTab(next);
            if (next === "tasks" && tasks.length === 0) void loadTasks();
          }}
        >
          <div className="border-b border-border bg-muted">
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
                  <span className="rounded-full bg-(--gray-100) px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{tab.count}</span>
                ) : null}
              </TabsTrigger>
            ))}
            </TabsList>
          </div>
        </Tabs>
        <div className="p-3 bg-accent/30">
          {activeTab === "notes" ? notes.length === 0 ? <EmptyHint icon="note" text="No notes yet — add context for everyone working this record." /> : <ul className="space-y-2.5">{notes.map((note) => {
          const noteCount = commentCounts[note.id] ?? 0;
          const noteOpen = Boolean(openComments[note.id]);
          return (
          <li key={note.id} className="group rounded-lg border border-border bg-card p-3 shadow-xs transition-colors hover:border-border/80 hover:bg-muted/30">
            <div className="flex items-start gap-3">
              <Initials name={note.author.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-semibold text-foreground">{note.author.name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Icon name="note" size={10} /> Note
                  </span>
                  <time className="ml-auto text-[11px] text-muted-foreground" dateTime={note.createdAt} title={absoluteTime(note.createdAt)}>
                    {relativeTime(note.createdAt)}
                  </time>
                </div>
                <div
                  className="mt-1.5 wrap-break-words text-[13px] leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
                  dangerouslySetInnerHTML={{ __html: renderRichText(note.body) }}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/70 pt-1.5">
              <button type="button" onClick={() => toggleComments(note.id)} aria-expanded={noteOpen} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Icon name={noteOpen ? "no_comment" : "comment"} size={12} />
                {noteOpen ? "Hide comments" : "Comments"}
                {noteCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">{noteCount}</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums">0</span>
                )}
              </button>
            </div>
            {noteOpen && me ? (
              <div className="mt-2.5 border-t border-border/70 pt-2.5">
                <CommentsSection subjectType="NOTE" subjectId={note.id} initial={[]} canComment={me.canComment} canManage={me.canManage} currentUserId={me.userId} compact lazyMount onCount={(count) => setCommentCounts((current) => ({ ...current, [note.id]: count }))} />
              </div>
            ) : null}
          </li>);})}</ul> : null}
          {activeTab === "tasks" ? tasksLoading ? <Skeleton className="h-12 w-full" /> : tasks.length === 0 ? <EmptyHint icon="square_check" text="No related tasks yet — create a follow-up above." /> : <ul className="space-y-2.5">{tasks.map((task) => {
          const taskCount = commentCounts[task.id] ?? 0;
          const taskOpen = Boolean(openComments[task.id]);
          return (
          <li key={task.id} className="group rounded-lg border border-border bg-card p-3 shadow-xs transition-colors hover:border-border/80 hover:bg-muted/30">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon name="square_check" size={14} /></span>
                <Link href={`/tasks/${task.id}`} className="min-w-0 truncate font-medium text-foreground hover:text-primary hover:underline">{task.title}</Link>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {task.dueAt ? (
                  <span className="badge badge-neutral gap-1"><Icon name="calendar" size={11} />{new Date(task.dueAt).toLocaleDateString()}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No due date</span>
                )}
                <StatusChip value={task.status} />
              </span>
            </div>
            <div className="mt-2 flex items-center justify-end border-t border-border/70 pt-1.5">
              <button type="button" onClick={() => toggleComments(task.id)} aria-expanded={taskOpen} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Icon name={taskOpen ? "no_comment" : "comment"} size={12} />
                {taskOpen ? "Hide comments" : "Comments"}
                {taskCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">{taskCount}</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums">0</span>
                )}
              </button>
            </div>
            {taskOpen && me ? (
              <div className="mt-2.5 border-t border-border/70 pt-2.5">
                <CommentsSection subjectType="TASK" subjectId={task.id} initial={[]} canComment={me.canComment} canManage={me.canManage} currentUserId={me.userId} compact lazyMount onCount={(count) => setCommentCounts((current) => ({ ...current, [task.id]: count }))} />
              </div>
            ) : null}
          </li>);})}</ul> : null}
          {activeTab === "appointments" ? appointments.length === 0 ? <EmptyHint icon="calendar" text="No appointments yet — schedule one above." /> : <ul className="space-y-2.5">{appointments.map((appointment) => {
          const apptCount = commentCounts[appointment.id] ?? 0;
          const apptOpen = Boolean(openComments[appointment.id]);
          return (
          <li key={appointment.id} className="group rounded-lg border border-border bg-card p-3 shadow-xs transition-colors hover:border-border/80 hover:bg-muted/30">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon name="calendar" size={14} /></span>
                <span className="truncate font-medium text-foreground">{appointment.title}</span>
              </span>
              <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
                <time className="text-xs text-muted-foreground" dateTime={appointment.startAt} title={absoluteTime(appointment.startAt)}>
                  {new Date(appointment.startAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </time>
                <StatusChip value={appointment.status} />
              </span>
            </div>
            {appointment.locationOrLink ? (
              <p className="mt-1.5 flex items-center gap-1.5 pl-9 text-xs text-muted-foreground">
                <Icon name="map_pin" size={11} className="shrink-0" />
                <span className="truncate">{appointment.locationOrLink}</span>
              </p>
            ) : null}
            <div className="mt-2 flex items-center justify-end border-t border-border/70 pt-1.5">
              <button type="button" onClick={() => toggleComments(appointment.id)} aria-expanded={apptOpen} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Icon name={apptOpen ? "no_comment" : "comment"} size={12} />
                {apptOpen ? "Hide comments" : "Comments"}
                {apptCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">{apptCount}</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums">0</span>
                )}
              </button>
            </div>
            {apptOpen && me ? (
              <div className="mt-2.5 border-t border-border/70 pt-2.5">
                <CommentsSection subjectType="APPOINTMENT" subjectId={appointment.id} initial={[]} canComment={me.canComment} canManage={me.canManage} currentUserId={me.userId} compact lazyMount onCount={(count) => setCommentCounts((current) => ({ ...current, [appointment.id]: count }))} />
              </div>
            ) : null}
          </li>);})}</ul> : null}
        </div>
      </div>
    </div>
  );
}
