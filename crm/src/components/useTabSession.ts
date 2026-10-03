"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Per-strip sessionStorage persistence for tab state: the active tab
 * survives a refresh and a hard refresh (sessionStorage, matching
 * useTableSession — a new tab/session starts clean).
 *
 * Restore happens in an effect (not a useState initializer): these
 * components are server-rendered, and lazy-initializing from
 * sessionStorage would hydrate different markup than the server sent.
 */

const PREFIX = "crm-tab-session:v1";

export function readTabSession(key: string, isValid: (value: string) => boolean): string | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: unknown };
    if (typeof parsed?.value !== "string" || !isValid(parsed.value)) {
      // Stored tab no longer exists (conditional tabs like Emails depend on
      // permissions) or the entry is corrupt — drop it, fall back clean.
      sessionStorage.removeItem(`${PREFIX}:${key}`);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeTabSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(`${PREFIX}:${key}`, JSON.stringify({ value }));
  } catch {
    // Quota/full storage — persistence is best-effort, never fatal.
  }
}

/**
 * Active-tab state with per-strip persistence. When `key` changes (e.g.
 * navigating to another record), the strip re-reads: the new location's
 * stored tab if it has one, else the fallback. `isValid` must reject any
 * value that is not one of the strip's currently renderable tabs.
 */
export function useTabSession(
  key: string,
  fallback: string,
  isValid: (value: string) => boolean = () => true,
): [string, (next: string) => void] {
  const [activeTab, setActiveTab] = useState(fallback);
  const isValidRef = useRef(isValid);
  isValidRef.current = isValid;

  useEffect(() => {
    setActiveTab(readTabSession(key, (value) => isValidRef.current(value)) ?? fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallback]);

  const updateTab = useCallback(
    (next: string) => {
      setActiveTab(next);
      writeTabSession(key, next);
    },
    [key],
  );

  return [activeTab, updateTab];
}
