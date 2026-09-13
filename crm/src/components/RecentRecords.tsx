"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecentRecord = { href: string; label: string; module: string; visitedAt: number };
const STORAGE_KEY = "crm-recent-records";
const MAX_RECORDS = 6;

function readRecent(): RecentRecord[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is RecentRecord => Boolean(item && typeof item === "object" && typeof (item as RecentRecord).href === "string" && typeof (item as RecentRecord).label === "string")) : [];
  } catch {
    return [];
  }
}

export function rememberRecentRecord(record: Omit<RecentRecord, "visitedAt">) {
  const next = [{ ...record, visitedAt: Date.now() }, ...readRecent().filter((item) => item.href !== record.href)].slice(0, MAX_RECORDS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("crm:recent-records-refresh"));
}

export function RecentRecords() {
  const [records, setRecords] = useState<RecentRecord[]>([]);

  useEffect(() => {
    const refresh = () => setRecords(readRecent());
    refresh();
    window.addEventListener("crm:recent-records-refresh", refresh);
    return () => window.removeEventListener("crm:recent-records-refresh", refresh);
  }, []);

  if (records.length === 0) return null;

  return (
    <section className="card p-5" aria-label="Recently visited records">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">Your shortcuts</p><h2 className="mt-1 text-lg font-semibold tracking-tight">Recently visited</h2></div>
        <button type="button" onClick={() => { window.localStorage.removeItem(STORAGE_KEY); setRecords([]); }} className="text-xs font-medium text-(--text-secondary) hover:text-(--text-primary)">Clear</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{records.map((record) => <Link key={record.href} href={record.href} className="card-interactive rounded-md border border-(--border-default) px-3 py-2 hover:bg-(--bg-hover)"><p className="truncate text-sm font-medium">{record.label}</p><p className="mt-0.5 text-xs text-(--text-tertiary)">{record.module}</p></Link>)}</div>
    </section>
  );
}
