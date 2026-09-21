"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

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
    <section className="section" aria-label="Recently visited records">
      <div className="section-header">
        <div className="min-w-0">
          <h2 className="section-title">Recently visited</h2>
          <p className="section-description">Your shortcuts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.localStorage.removeItem(STORAGE_KEY);
              setRecords([]);
            }}
          >
            Clear
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-(--border-hairline)">
        {records.map((record) => (
          <li key={record.href}>
            <Link href={record.href} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-(--bg-hover)">
              <span className="min-w-0 truncate font-medium">{record.label}</span>
              <span className="shrink-0 text-xs text-(--text-tertiary)">{record.module}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
