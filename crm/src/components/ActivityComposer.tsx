"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, IconInput, IconSelectTrigger } from "@/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

/**
 * Activity Composer — the compact action bar that sits above the timeline
 * on every record page (Salesforce-style). Provides one-click access to the
 * core activity actions: Note, Task, and Schedule.
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

  async function post(url: string, payload: Record<string, unknown>, successTitle: string, successDescription: string, reset: () => void) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? "Something went wrong.";
        setError(message);
        toast.error(successTitle + " failed", { description: message });
        return;
      }
      reset();
      setActiveAction("none");
      toast.success(successTitle, { description: successDescription });
      refreshAfterToast();
    } catch {
      setError("Check your connection and try again.");
      toast.error(successTitle + " failed", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const actions = [
    { key: "note", label: "Note", icon: "edit", enabled: canAddNote },
    { key: "task", label: "Task", icon: "square_check", enabled: canCreateTask },
    { key: "appointment", label: "Schedule", icon: "calendar", enabled: canScheduleAppointment },
  ].filter((action) => action.enabled);

  return (
    <Card className="no-print gap-0 overflow-hidden py-0" style={{ overflow: "hidden" }}>
      {/* Action bar */}
      <div
        className="flex items-center gap-1 border-b px-2.5 py-2"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-subtle)" }}
      >
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          Log
        </span>
        {actions.map((action) => {
          const active = activeAction === action.key;
          return (
            <Button
              key={action.key}
              variant={active ? "primary" : "tertiary"}
              size="sm"
              icon={action.icon}
              aria-pressed={active}
              onClick={() => { setError(null); setActiveAction(active ? "none" : (action.key as never)); }}
            >
              {action.label}
            </Button>
          );
        })}
      </div>

      {activeAction !== "none" ? <FormError message={error} /> : null}

      {/* Note composer */}
      {activeAction === "note" ? (
        <form
          method="post"
          className="space-y-2.5 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void post(
              "/api/notes",
              { body: noteBody, subjectType, subjectId },
              "Note added",
              `Note added to ${subjectLabel}.`,
              () => setNoteBody(""),
            );
          }}
        >
          <div>
            <p className="form-section-title">Note</p>
            <p className="form-section-help">Context for everyone who works {subjectLabel} — visible on the timeline.</p>
          </div>
          <Textarea
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            placeholder={`e.g. Spoke with ${subjectLabel} — discussed onboarding timeline.`}
            rows={3}
            required
            maxLength={5000}
            className="resize-y"
            autoFocus
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && event.currentTarget.form?.requestSubmit) {
                event.currentTarget.form.requestSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-(--text-tertiary)">
              {noteBody.length.toLocaleString()} / 5,000 · ⌘/Ctrl+Enter to save
            </p>
            <div className="flex gap-2">
              <Button variant="tertiary" onClick={() => setActiveAction("none")}>Cancel</Button>
              <Button variant="primary" icon="check" type="submit" loading={busy} disabled={!noteBody.trim()}>
                Save note
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      {/* Task composer */}
      {activeAction === "task" ? (
        <form
          method="post"
          className="space-y-3 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void post(
              "/api/tasks",
              { title: taskTitle, dueAt: taskDue || null, priority: taskPriority, subjectType, subjectId },
              "Task created",
              `Follow-up task created for ${subjectLabel}.`,
              () => { setTaskTitle(""); setTaskDue(""); setTaskPriority("NORMAL"); },
            );
          }}
        >
          <div>
            <p className="form-section-title">Follow-up task</p>
            <p className="form-section-help">A task linked to {subjectLabel} — appears on their timeline and your queue.</p>
          </div>
          <Field label="What needs to happen" required id="ac-task-title">
            <IconInput
              id="ac-task-title"
              icon="square_check"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder={`e.g. Send follow-up proposal to ${subjectLabel}`}
              required
              minLength={2}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due" help="Optional — leave empty for unscheduled." id="ac-task-due">
              <IconInput
                id="ac-task-due"
                icon="calendar"
                type="datetime-local"
                value={taskDue}
                onChange={(event) => setTaskDue(event.target.value)}
              />
            </Field>
            <Field label="Priority" id="ac-task-priority">
              <Select value={taskPriority} onValueChange={setTaskPriority}>
                <IconSelectTrigger id="ac-task-priority" icon="sliders">
                  <SelectValue />
                </IconSelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" onClick={() => setActiveAction("none")}>Cancel</Button>
            <Button variant="primary" icon="plus" type="submit" loading={busy} disabled={!taskTitle.trim()}>
              Add task
            </Button>
          </div>
        </form>
      ) : null}

      {/* Schedule composer */}
      {activeAction === "appointment" ? (
        <form
          method="post"
          className="space-y-3 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void post(
              "/api/appointments",
              { title: apptTitle, startAt: apptStart, subjectType, subjectId },
              "Appointment scheduled",
              `Appointment scheduled with ${subjectLabel}.`,
              () => { setApptTitle(""); setApptStart(""); },
            );
          }}
        >
          <div>
            <p className="form-section-title">Schedule</p>
            <p className="form-section-help">An appointment with {subjectLabel} — logged on the activity timeline.</p>
          </div>
          <Field label="What" required id="ac-appt-title">
            <IconInput
              id="ac-appt-title"
              icon="calendar"
              value={apptTitle}
              onChange={(event) => setApptTitle(event.target.value)}
              placeholder={`e.g. Onboarding call with ${subjectLabel}`}
              required
              minLength={2}
              autoFocus
            />
          </Field>
          <Field label="Starts" required id="ac-appt-start" help="You'll find it in the timeline and your task list.">
            <IconInput
              id="ac-appt-start"
              icon="calendar"
              type="datetime-local"
              value={apptStart}
              onChange={(event) => setApptStart(event.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" onClick={() => setActiveAction("none")}>Cancel</Button>
            <Button variant="primary" icon="calendar" type="submit" loading={busy} disabled={!apptTitle.trim() || !apptStart}>
              Schedule
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
