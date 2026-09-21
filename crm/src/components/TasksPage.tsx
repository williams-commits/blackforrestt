"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { SmartTips } from "@/components/SmartTips";
import { useTableSession, writeTableSession } from "@/components/useTableSession";

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
  _count?: { viewerUsers: number; viewerTeams: number };
  viewerUsers?: Array<{ user: { id: string; name: string } }>;
  viewerTeams?: Array<{ team: { id: string; name: string } }>;
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
  const [page, setPage] = useState(1);
  const [mine, setMine] = useState("1");
  const [pageSize, setPageSize] = useState(25);
  const [hydrated, setHydrated] = useState(false);
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
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewerUserIds, setViewerUserIds] = useState<string[]>([]);
  const [viewerTeamIds, setViewerTeamIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const editConsumed = useRef(false);

  const effectiveMine = isAdmin ? mine : "1";
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  // Debounce the search box (mirrors RecordListPage) — one request per
  // keystroke otherwise.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Restore the saved table session (search/filters/page) after mount —
  // skipped for subject deep-links (?subjectType=…), where the linking
  // context decides the view.
  const { session, ready } = useTableSession("tasks");
  useEffect(() => {
    if (!ready) return;
    if (session && !subjectType && !subjectId) {
      if (typeof session.search === "string") {
        setQuery(session.search);
        setDebouncedQuery(session.search);
      }
      if (session.filters) {
        if (typeof session.filters.status === "string") setStatus(session.filters.status);
        if (typeof session.filters.priority === "string") setPriorityFilter(session.filters.priority);
        if (session.filters.due === "all" || session.filters.due === "overdue" || session.filters.due === "today" || session.filters.due === "week" || session.filters.due === "upcoming") setDue(session.filters.due);
        if (session.filters.mine === "0" || session.filters.mine === "1") setMine(session.filters.mine);
      }
      if (session.page !== undefined) setPage(session.page);
      if (session.pageSize !== undefined) setPageSize(session.pageSize);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session]);

  useEffect(() => {
    if (!hydrated) return;
    writeTableSession("tasks", {
      page,
      pageSize,
      search: query,
      filters: { status, priority: priorityFilter, due, mine },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, page, pageSize, query, status, priorityFilter, due, mine]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ due, mine: effectiveMine, pageSize: String(pageSize), page: String(page) });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
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
  }, [status, due, effectiveMine, subjectType, subjectId, debouncedQuery, priorityFilter, page, pageSize]);

  useEffect(() => {
    if (!hydrated) return;
    void fetchTasks();
  }, [fetchTasks, hydrated]);

  // A restored page can outrun the result set — clamp to the last real
  // page instead of showing an empty one.
  useEffect(() => {
    if (!hydrated || loading) return;
    if (page > totalPages) setPage(totalPages);
  }, [hydrated, loading, page, totalPages]);

  useEffect(() => {
    void fetch("/api/users").then((response) => response.ok ? response.json() : null).then((body) => setUsers((body?.data ?? []).map((user: UserOption) => ({ id: user.id, name: user.name })))).catch(() => setUsers([]));
    void fetch("/api/teams").then((response) => response.ok ? response.json() : null).then((body) => setTeams((body?.data ?? []).map((team: { id: string; name: string }) => ({ id: team.id, name: team.name })))).catch(() => setTeams([]));
    void fetch("/api/me").then((response) => response.ok ? response.json() : null).then((body) => {
      const role = (body?.data?.roleKey ?? "") as string;
      setIsAdmin(role === "SUPER_ADMIN" || role === "ADMIN");
    }).catch(() => setIsAdmin(false));
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
        viewerUserIds,
        viewerTeamIds,
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
    setViewerUserIds([]);
    setViewerTeamIds([]);
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

  const openEdit = useCallback((task: TaskRow) => {
    setEditingTask(task);
    setShowForm(true);
    setFormError(null);
    setTitle(task.title);
    setDescription(task.description ?? "");
    // datetime-local inputs hold LOCAL wall time — a raw UTC ISO string here
    // silently shifts the value by the user's UTC offset on every save.
    setTaskDue(task.dueAt ? toLocalInputValue(task.dueAt) : "");
    setRecurrence(task.recurrence ?? "NONE");
    setReminderAt(task.reminderAt ? toLocalInputValue(task.reminderAt) : "");
    setPriority(task.priority);
    setOwnerUserId(task.owner?.id ?? "");
    setViewerUserIds((task.viewerUsers ?? []).map((entry) => entry.user.id));
    setViewerTeamIds((task.viewerTeams ?? []).map((entry) => entry.team.id));
  }, []);
  // Deep link from the task detail page: ?edit=<id> opens the inline editor
  // prefilled with that row (one-shot; later loads are normal).
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || editConsumed.current) return;
    const target = rows.find((row) => row.id === editId);
    if (target) {
      editConsumed.current = true;
      openEdit(target);
    }
  }, [rows, searchParams, openEdit]);

/** UTC instant → local datetime-local value (YYYY-MM-DDTHH:mm). */
function toLocalInputValue(instant: string | Date): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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
          <fieldset className="sm:col-span-4">
            <legend className="form-label">Viewers (can view, not edit)</legend>
            <div className="flex flex-wrap items-center gap-2">
              {viewerUserIds.map((id) => {
                const user = users.find((entry) => entry.id === id);
                return (
                  <span key={`u-${id}`} className="badge badge-neutral">
                    {user?.name ?? id.slice(-6)}
                    <button type="button" aria-label={`Remove viewer ${user?.name ?? id}`} onClick={() => setViewerUserIds((current) => current.filter((entry) => entry !== id))} className="ml-1 text-(--text-tertiary) hover:text-(--error)">×</button>
                  </span>
                );
              })}
              {viewerTeamIds.map((id) => {
                const team = teams.find((entry) => entry.id === id);
                return (
                  <span key={`t-${id}`} className="badge badge-neutral">
                    {team ? `${team.name} (team)` : `team …${id.slice(-6)}`}
                    <button type="button" aria-label={`Remove team viewer ${team?.name ?? id}`} onClick={() => setViewerTeamIds((current) => current.filter((entry) => entry !== id))} className="ml-1 text-(--text-tertiary) hover:text-(--error)">×</button>
                  </span>
                );
              })}
              <select
                aria-label="Add user viewer"
                value=""
                onChange={(event) => {
                  if (event.target.value) setViewerUserIds((current) => [...new Set([...current, event.target.value])]);
                  event.target.value = "";
                }}
                className="input w-44"
              >
                <option value="">+ User…</option>
                {users.filter((user) => !viewerUserIds.includes(user.id)).map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <select
                aria-label="Add team viewer"
                value=""
                onChange={(event) => {
                  if (event.target.value) setViewerTeamIds((current) => [...new Set([...current, event.target.value])]);
                  event.target.value = "";
                }}
                className="input w-44"
              >
                <option value="">+ Team…</option>
                {teams.filter((team) => !viewerTeamIds.includes(team.id)).map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          </fieldset>
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
        <input id="task-search" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} placeholder="Search tasks" className="input md:w-64" />
        <select
          aria-label="Status filter"
          value={status}
          onChange={(event) => { setPage(1); setStatus(event.target.value); }}
          className="input"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select aria-label="Priority filter" value={priorityFilter} onChange={(event) => { setPage(1); setPriorityFilter(event.target.value); }} className="input">
          <option value="">Priority: any</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </select>
        <select
          aria-label="Due filter"
          value={due}
          onChange={(event) => { setPage(1); setDue(event.target.value); }}
          className="input"
        >
          {DUE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isAdmin ? (
          <select
            aria-label="Ownership filter"
            value={mine}
            onChange={(event) => { setPage(1); setMine(event.target.value); }}
            className="input"
          >
            <option value="1">My & shared tasks</option>
            <option value="0">Everyone (admins only)</option>
          </select>
        ) : null}
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
                    <Link href={`/tasks/${task.id}`} className="font-medium text-(--text-primary) hover:text-(--text-brand) hover:underline">
                      {task.title}
                    </Link>
                    {(task._count && (task._count.viewerUsers > 0 || task._count.viewerTeams > 0)) ? (
                      <p className="text-xs text-(--text-tertiary)">
                        shared with {task._count.viewerUsers + task._count.viewerTeams} viewer{task._count.viewerUsers + task._count.viewerTeams === 1 ? "" : "s"}
                      </p>
                    ) : null}
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

      <div className="flex flex-wrap items-center justify-between gap-2" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
        <span>
          {meta.total > 0 ? (
            <>
              Showing{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)}
              </strong>{" "}
              of {meta.total}
              <span style={{ marginLeft: "8px" }}>
                · Page <strong style={{ color: "var(--text-primary)" }}>{meta.page}</strong> of {totalPages}
              </span>
            </>
          ) : (
            <>
              Page <strong style={{ color: "var(--text-primary)" }}>{meta.page}</strong> of {totalPages}
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Rows
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="btn btn-secondary btn-sm"
              style={{ width: "auto" }}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={meta.page <= 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="btn btn-secondary btn-sm"
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={meta.page >= totalPages || loading}
            onClick={() => setPage((value) => value + 1)}
            className="btn btn-secondary btn-sm"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
