"use client";

import { useEffect, useState } from "react";

/**
 * Per-table sessionStorage persistence: page, search, sort, filters,
 * selection … survive a refresh and hold for the browser session, then
 * reset for a fresh one (sessionStorage, matching RecordWorkspaceTabs —
 * a new tab/session starts clean). The hook only READS; callers own the
 * state and call writeTableSession when it changes.
 *
 * Restore happens in an effect (not a useState initializer): these
 * components are server-rendered, and lazy-initializing from
 * sessionStorage would hydrate different markup than the server sent.
 */

const PREFIX = "crm-table-session:v1";
const MAX_SELECTED = 500;

export interface TableSession {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  filters?: Record<string, string>;
  hiddenColumns?: string[];
  density?: "comfortable" | "compact";
  activeView?: string;
  selected?: string[];
}

export function readTableSession(key: string): TableSession | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TableSession;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const session: TableSession = {};
    if (typeof parsed.page === "number" && Number.isInteger(parsed.page) && parsed.page >= 1) {
      session.page = parsed.page;
    }
    if (typeof parsed.pageSize === "number" && Number.isInteger(parsed.pageSize) && parsed.pageSize >= 1 && parsed.pageSize <= 100) {
      session.pageSize = parsed.pageSize;
    }
    if (typeof parsed.search === "string") session.search = parsed.search.slice(0, 120);
    if (typeof parsed.sort === "string") session.sort = parsed.sort.slice(0, 40);
    if (parsed.order === "asc" || parsed.order === "desc") session.order = parsed.order;
    if (parsed.density === "comfortable" || parsed.density === "compact") session.density = parsed.density;
    if (typeof parsed.activeView === "string") session.activeView = parsed.activeView.slice(0, 80);
    if (parsed.filters && typeof parsed.filters === "object") {
      const filters: Record<string, string> = {};
      for (const [name, value] of Object.entries(parsed.filters).slice(0, 20)) {
        if (typeof value === "string") filters[name.slice(0, 40)] = value.slice(0, 120);
      }
      session.filters = filters;
    }
    if (Array.isArray(parsed.hiddenColumns)) {
      session.hiddenColumns = parsed.hiddenColumns
        .filter((value): value is string => typeof value === "string")
        .slice(0, 50)
        .map((value) => value.slice(0, 80));
    }
    if (Array.isArray(parsed.selected)) {
      session.selected = parsed.selected
        .filter((value): value is string => typeof value === "string" && value.length >= 5)
        .slice(0, MAX_SELECTED);
    }
    return session;
  } catch {
    sessionStorage.removeItem(`${PREFIX}:${key}`);
    return null;
  }
}

export function writeTableSession(key: string, session: TableSession): void {
  try {
    sessionStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(session));
  } catch {
    // Quota/full storage — persistence is best-effort, never fatal.
  }
}

/**
 * Read the saved session once per key. `session` is the validated snapshot
 * (null when none was saved); `ready` flips true after the read so callers
 * can gate first fetch/render on restoration instead of double-fetching.
 */
export function useTableSession(key: string): { session: TableSession | null; ready: boolean } {
  const [session, setSession] = useState<TableSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSession(readTableSession(key));
    setReady(true);
  }, [key]);
  return { session, ready };
}
