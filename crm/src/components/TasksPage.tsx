"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { SmartTips } from "@/components/SmartTips";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  recurrence: string;
  reminderAt: string | null;
  priority: string;
  status: string;
  owner: { id: string; name: string } | null;
  subjectType: string | null;
  subjectId: string | null;
}

interface TasksResponse {
  data: TaskRow[];
  meta: { page: number; pageSize: number; total: number; openCount: number; overdueCount: number };
}

interface UserOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Status: open" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const DUE_OPTIONS = [
  { value: "all", label: "Due: any" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "upcoming", label: "Upcoming" },
];

const SUBJECT_PATH: Record<string, string> = {
  LEAD: "leads",
  CONTACT: "contacts",
  ACCOUNT: "accounts",
  CUSTOMER: "customers",
  OPPORTUNITY: "opportunities",
};

function formatDue(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  const now = new Date();
  const isOverdue = date < now;
  const text = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return isOverdue ? `⚠ ${text}` : text;
}

export function TasksPage() {
  const searchParams = useSearchParams();
  const subjectType = searchParams.get("subjectType") ?? undefined;
  const subjectId = searchParams.get("subjectId") ?? undefined;
  const subjectLabel = searchParams.get("label") ?? "";

  const [rows, setRows] = useState<TaskRow[]>([]);
  const [meta, setMeta] = useState<TasksResponse["meta"]>({
    page: 1,
    pageSize: 25,
    total: 0,
    openCount: 0,
    overdueCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [due, setDue] = useState("all");
  const [mine, setMine] = useState("1");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState(subjectLabel ? `Follow up: ${subjectLabel}` : "");
  const [description, setDescription] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [recurrence, setRecurrence] = useState("NONE");
  const [reminderAt, setReminderAt] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ due, mine, pageSize: "25" });
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (subjectType) params.set("subjectType", subjectType);
      if (subjectId) params.set("subjectId", subjectId);
      const response = await fetch(`/api/tasks?${params.toString()}`);
      const body = await response.json().catch(() => null) as (TasksResponse & { error?: string }) | null;
      if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
      setRows(body?.data ?? []);
      setMeta(body?.meta ?? { page: 1, pageSize: 25, total: 0, openCount: 0, overdueCount: 0 });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [status, due, mine, subjectType, subjectId, query, priorityFilter]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    void fetch("/api/users").then((response) => response.ok ? response.json() : null).then((body) => setUsers((body?.data ?? []).map((user: UserOption) => ({ id: user.id, name: user.name })))).catch(() => setUsers([]));
  }, []);

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const response = await fetch(editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks", {
      method: editingTask ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        dueAt: taskDue || null,
        priority,
        recurrence,
        reminderAt: reminderAt || null,
        ...(ownerUserId ? { ownerUserId } : {}),
        ...(subjectType && subjectId ? { subjectType, subjectId } : {}),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setFormError(body?.error ?? "Could not create task.");
      return;
    }
    setShowForm(false);
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setTaskDue("");
    setRecurrence("NONE");
    setReminderAt("");
    setPriority("NORMAL");
    setOwnerUserId("");
    void fetchTasks();
  }

  async function setTaskStatus(id: string, next: string) {
    setActionError(null);
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setActionError(body?.error ?? "Could not update the task.");
      return;
    }
    void fetchTasks();
  }

  function openEdit(task: TaskRow) {
    setEditingTask(task);
    setShowForm(true);
    setFormError(null);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setTaskDue(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : "");
    setRecurrence(task.recurrence ?? "NONE");
    setReminderAt(task.reminderAt ? new Date(task.reminderAt).toISOString().slice(0, 16) : "");
    setPriority(task.priority);
    setOwnerUserId(task.owner?.id ?? "");
  }

  const inputClass =
    "w-full rounded-md border border-(--border-strong) px-3 py-2 text-sm focus:border-(--brand) focus:outline-none";

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Work queue"
        title="Tasks"
        subtitle={subjectLabel ? `Follow-up work for ${subjectLabel}` : "Keep the next action visible and moving."}
        actions={<button type="button" onClick={() => setShowForm((previous) => !previous)} className="btn btn-primary"><span aria-hidden>+</span> New task</button>}
        metrics={[{ label: "Open", value: meta.openCount, tone: "brand" }, { label: "Overdue", value: meta.overdueCount, tone: meta.overdueCount > 0 ? "warning" : "success" }, { label: "Showing", value: meta.total, tone: "info" }]}
      />
      <WorkspaceQuickNav />
      <SmartTips context="tasks" />

      {showForm ? (
        <form
          method="post"
          onSubmit={createTask}
          className="grid gap-4 rounded-xl border border-(--border-default) bg-(--bg-surface) p-5 shadow-(--shadow-subtle) sm:grid-cols-4"
        >
          <div className="sm:col-span-4"><p className="form-dialog-eyebrow">Next action</p><p className="form-section-title">{editingTask ? "Edit task" : "Create a task"}</p><p className="form-section-help">Make the owner, timing, and urgency explicit.</p></div>
          {formError ? (
            <p role="alert" className="sm:col-span-4 rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
              {formError}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <label htmlFor="t-title" className="form-label">
              Title <span aria-hidden>*</span>
            </label>
            <input
              id="t-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={2}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-4">
            <label htmlFor="t-description" className="form-label">Description</label>
            <textarea id="t-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={inputClass} placeholder="Add useful context for the next action" />
          </div>
          <div>
              <label htmlFor="t-due" className="form-label">
              Due
            </label>
            <input
              id="t-due"
              type="datetime-local"
              value={taskDue}
              onChange={(event) => setTaskDue(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="t-owner" className="form-label">Owner</label>
            <select id="t-owner" value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)} className={inputClass}>
              <option value="">Me</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="t-recurrence" className="form-label">Repeat</label>
            <select id="t-recurrence" value={recurrence} onChange={(event) => setRecurrence(event.target.value)} className={inputClass}>
              <option value="NONE">Does not repeat</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div>
            <label htmlFor="t-reminder" className="form-label">Reminder</label>
            <input id="t-reminder" type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="t-priority" className="form-label">
              Priority
            </label>
            <select
              id="t-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className={inputClass}
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="form-actions sm:col-span-4">
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: "var(--brand)" }}
            >
              <span aria-hidden>{editingTask ? "✓" : "+"}</span> {editingTask ? "Save task" : "Create task"}
            </button>
          </div>
        </form>
      ) : null}

      {actionError ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{actionError}</p> : null}
      <div className="flex flex-col gap-2 rounded-lg border border-(--border-default) bg-(--bg-surface) p-3 md:flex-row">
        <label htmlFor="task-search" className="sr-only">Search tasks</label>
        <input id="task-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" className="input md:w-64" />
        <select
          aria-label="Status filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="input"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select aria-label="Priority filter" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="input">
          <option value="">Priority: any</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </select>
        <select
          aria-label="Due filter"
          value={due}
          onChange={(event) => setDue(event.target.value)}
          className="input"
        >
          {DUE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Ownership filter"
          value={mine}
          onChange={(event) => setMine(event.target.value)}
          className="input"
        >
          <option value="1">My tasks</option>
          <option value="0">Everyone (in my scope)</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr className="border-b border-(--border-default) bg-(--bg-hover) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={`sk-${i}`}><td colSpan={6} style={{ padding: "10px 12px" }}><div className="skeleton" style={{ height: "16px", width: `${75 - i * 10}%` }} /></td></tr>
              ))
            ) : loadError ? (
              <tr><td colSpan={6}><div className="empty-state"><p className="empty-state-title" style={{ color: "var(--error)" }}>{loadError}</p><button type="button" onClick={() => void fetchTasks()} className="btn btn-secondary" style={{ marginTop: "var(--space-3)" }}>Retry</button></div></td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <p className="empty-state-title">No tasks found</p>
                    <p className="empty-state-description">Try adjusting your filters or create a new task.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((task) => (
                <tr key={task.id} className={task.status === "COMPLETED" ? "opacity-50" : ""}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{task.title}</p>
                    {task.subjectType && task.subjectId ? (
                      <p className="text-xs text-(--text-tertiary)">
                        linked to {SUBJECT_PATH[task.subjectType] ? <Link href={`/${SUBJECT_PATH[task.subjectType]}/${task.subjectId}`} className="text-(--text-brand) hover:underline">{task.subjectType.toLowerCase()} …{task.subjectId.slice(-6)}</Link> : `${task.subjectType.toLowerCase()} …${task.subjectId.slice(-6)}`}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDue(task.dueAt)}</td>
                  <td className="px-3 py-2">{task.priority.toLowerCase()}</td>
                  <td className="px-3 py-2">{task.owner?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="badge badge-neutral">
                      {task.status.replaceAll("_", " ").toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {task.status !== "COMPLETED" && task.status !== "CANCELLED" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void setTaskStatus(task.id, "COMPLETED")}
                          className="mr-2 text-(--brand) hover:underline"
                        >
                          Complete
                        </button>
                        <button type="button" onClick={() => openEdit(task)} className="mr-2 text-(--text-secondary) hover:underline">Edit</button>
                        <button
                          type="button"
                          onClick={() => void setTaskStatus(task.id, "CANCELLED")}
                          className="text-(--error) hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void setTaskStatus(task.id, "OPEN")}
                        className="text-(--text-secondary) hover:underline"
                      >
                        Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
