"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
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
  const [status, setStatus] = useState("");
  const [due, setDue] = useState("all");
  const [mine, setMine] = useState("1");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState(subjectLabel ? `Follow up: ${subjectLabel}` : "");
  const [taskDue, setTaskDue] = useState("");
  const [priority, setPriority] = useState("NORMAL");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ due, mine, pageSize: "25" });
      if (status) params.set("status", status);
      if (subjectType) params.set("subjectType", subjectType);
      if (subjectId) params.set("subjectId", subjectId);
      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (response.ok) {
        const body = (await response.json()) as TasksResponse;
        setRows(body.data);
        setMeta(body.meta);
      }
    } finally {
      setLoading(false);
    }
  }, [status, due, mine, subjectType, subjectId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        dueAt: taskDue || null,
        priority,
        ...(subjectType && subjectId ? { subjectType, subjectId } : {}),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setFormError(body?.error ?? "Could not create task.");
      return;
    }
    setShowForm(false);
    setTitle("");
    setTaskDue("");
    setPriority("NORMAL");
    void fetchTasks();
  }

  async function setTaskStatus(id: string, next: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    void fetchTasks();
  }

  const inputClass =
    "w-full rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {meta.openCount} open · {meta.overdueCount} overdue
            {subjectLabel ? ` · for ${subjectLabel}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((previous) => !previous)}
          className="btn btn-primary"
          style={{ background: "var(--brand)" }}
        >
          New task
        </button>
      </div>

      {showForm ? (
        <form
          method="post"
          onSubmit={createTask}
          className="grid gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:grid-cols-4"
        >
          {formError ? (
            <p role="alert" className="sm:col-span-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
              {formError}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <label htmlFor="t-title" className="mb-1 block text-sm font-medium">
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
          <div>
            <label htmlFor="t-due" className="mb-1 block text-sm font-medium">
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
            <label htmlFor="t-priority" className="mb-1 block text-sm font-medium">
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
          <div className="sm:col-span-4">
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: "var(--brand)" }}
            >
              Create
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
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
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
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
                      <p className="text-xs text-[var(--text-tertiary)]">
                        linked to {task.subjectType.toLowerCase()} …{task.subjectId.slice(-6)}
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
                          className="mr-2 text-[var(--brand)] hover:underline"
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => void setTaskStatus(task.id, "CANCELLED")}
                          className="text-[var(--error)] hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void setTaskStatus(task.id, "OPEN")}
                        className="text-[var(--text-secondary)] hover:underline"
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
