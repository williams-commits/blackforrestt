"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { notificationHref } from "@/lib/notificationLink";

type NotificationRow = { id: string; type: string; payload: Record<string, unknown>; readAt: string | null; createdAt: string };
type ResponseData = { data: NotificationRow[]; meta: { unread: number; total: number; page: number; pageSize: number; hasMore: boolean } };

const TYPE_LABELS: Record<string, string> = { RECORD_ASSIGNED: "Assignment", TASK_CREATED: "Task", TASK_DUE: "Task due", TASK_OVERDUE: "Overdue task", APPOINTMENT_SCHEDULED: "Appointment", IMPORT_COMPLETED: "Import completed", IMPORT_FAILED: "Import failed", PLATFORM_USER_ONLINE: "Client activity", SYSTEM: "System" };

function titleFor(row: NotificationRow) {
  const label = TYPE_LABELS[row.type] ?? row.type.replaceAll("_", " ").toLowerCase();
  const subject = row.payload.label ?? row.payload.title;
  return typeof subject === "string" ? `${label}: ${subject}` : label;
}

export function NotificationCenter() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [read, setRead] = useState("all");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ read, page: String(page), pageSize: "25" });
      if (type) params.set("type", type);
      const response = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Unable to load notifications.");
      setData(body as ResponseData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    } finally { setLoading(false); }
  }, [page, read, type]);

  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => data?.data ?? [], [data]);
  const types = useMemo(() => [...new Set(rows.map((row) => row.type))], [rows]);

  async function setReadState(row: NotificationRow, nextRead: boolean) {
    setData((current) => current ? { ...current, data: current.data.map((item) => item.id === row.id ? { ...item, readAt: nextRead ? new Date().toISOString() : null } : item) } : current);
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, read: nextRead }) });
    if (!response.ok) void load();
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (response.ok) void load();
  }

  return <div className="space-y-4">
    <WorkspaceHeader eyebrow="Workspace inbox" title="Notifications" subtitle="Actionable updates from assignments, tasks, imports, and system activity." actions={data?.meta.unread ? <button type="button" onClick={() => void markAllRead()} className="btn btn-secondary">Mark all read</button> : undefined} metrics={[{ label: "Unread", value: data?.meta.unread ?? 0, tone: data?.meta.unread ? "warning" : "success" }, { label: "Showing", value: data?.meta.total ?? 0, tone: "info" }]} />
    <WorkspaceQuickNav />
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-(--border-default) bg-(--bg-subtle) p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Notification state">{[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }, { value: "read", label: "Read" }].map((item) => <button key={item.value} type="button" role="tab" aria-selected={read === item.value} onClick={() => { setRead(item.value); setPage(1); }} className={`rounded-md px-3 py-1.5 text-sm font-medium ${read === item.value ? "bg-(--bg-surface) shadow-sm" : "text-(--text-secondary) hover:bg-(--bg-hover)"}`}>{item.label}</button>)}</div>
        <select aria-label="Notification type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className="input sm:w-52"><option value="">All event types</option>{types.map((item) => <option key={item} value={item}>{TYPE_LABELS[item] ?? item}</option>)}</select>
      </div>
      {error ? <div className="m-4 rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error} <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Retry</button></div> : null}
      {loading && rows.length === 0 ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-16 rounded-md" />)}</div> : rows.length === 0 ? <div className="empty-state"><p className="empty-state-title">You are all caught up</p><p className="empty-state-description">Meaningful assignments, reminders, and system events will appear here.</p></div> : <ul className="divide-y divide-(--border-default)">{rows.map((row) => <li key={row.id} className={`flex gap-4 p-4 transition-colors hover:bg-(--bg-hover) ${row.readAt ? "" : "bg-(--bg-selected)"}`}><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${row.readAt ? "border border-(--border-strong)" : "bg-(--brand)"}`} /><div className="min-w-0 flex-1"><Link href={notificationHref(row)} className="font-medium hover:text-(--text-brand)">{titleFor(row)}</Link><p className="mt-1 text-xs text-(--text-tertiary)">{new Date(row.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p></div><button type="button" onClick={() => void setReadState(row, !row.readAt)} className="shrink-0 text-xs font-medium text-(--text-brand) hover:underline">{row.readAt ? "Mark unread" : "Mark read"}</button></li>)}</ul>}
      {data && (data.meta.page > 1 || data.meta.hasMore) ? <div className="flex items-center justify-between border-t border-(--border-default) px-4 py-3 text-xs text-(--text-secondary)"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn btn-secondary disabled:opacity-40">Previous</button><span>Page {page}</span><button type="button" disabled={!data.meta.hasMore || loading} onClick={() => setPage((value) => value + 1)} className="btn btn-secondary disabled:opacity-40">Next</button></div> : null}
    </div>
  </div>;
}