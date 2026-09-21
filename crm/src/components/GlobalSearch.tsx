"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

interface Hit {
  objectType: string;
  id: string;
  label: string;
  subtitle: string | null;
  url: string;
}

const TYPE_ORDER = ["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY", "CAMPAIGN", "TASK", "NOTE"];
const TYPE_LABELS: Record<string, string> = {
  LEAD: "Leads",
  CONTACT: "Contacts",
  ACCOUNT: "Accounts",
  CUSTOMER: "Customers",
  OPPORTUNITY: "Opportunities",
  CAMPAIGN: "Campaigns",
  TASK: "Tasks",
  NOTE: "Notes",
};

/** Global search: enterprise bar with `/` shortcut, grouped dropdown results. */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (response.ok) {
          setHits((await response.json()).data);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      // `/` focuses the search bar (Salesforce-style shortcut)
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const grouped = new Map<string, Hit[]>();
  for (const type of TYPE_ORDER) {
    const list = hits.filter((hit) => hit.objectType === type);
    if (list.length > 0) grouped.set(type, list);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors"
        style={{
          borderColor: open ? "var(--brand)" : "var(--border-strong)",
          background: "var(--bg-surface)",
        }}
      >
        <Icon name="search" size={14} className="text-(--text-tertiary)" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Global search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && query.trim().length >= 2) {
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }
          }}
          placeholder="Search… (press / )"
          className="w-full bg-transparent text-[13px] outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        {loading ? (
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>…</span>
        ) : null}
      </div>

      {open && query.trim().length >= 2 ? (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-95 overflow-y-auto rounded-lg border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-default)",
            boxShadow: "var(--shadow-dropdown)",
          }}
        >
          {loading ? (
            <p className="px-3 py-3 text-[13px]" style={{ color: "var(--text-tertiary)" }}>Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-3 text-[13px]" style={{ color: "var(--text-tertiary)" }}>No matches in your scope.</p>
          ) : (
            [...grouped.entries()].map(([type, list]) => (
              <div key={type}>
                <p
                  className="border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)", borderColor: "var(--border-default)", background: "var(--bg-subtle)" }}
                >
                  {TYPE_LABELS[type] ?? type.toLowerCase()} ({list.length})
                </p>
                {list.map((hit) => (
                  <a
                    key={`${hit.objectType}-${hit.id}`}
                    href={hit.url}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-(--bg-hover)"
                    style={{ textDecoration: "none", color: "var(--text-primary)" }}
                  >
                    <span className="truncate font-medium">{hit.label}</span>
                    <span className="shrink-0 truncate text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      {hit.subtitle}
                    </span>
                  </a>
                ))}
              </div>
            ))
          )}
          <a
            href={`/search?q=${encodeURIComponent(query.trim())}`}
            onClick={() => setOpen(false)}
            className="block border-t px-3 py-2 text-center text-[12px] font-medium transition-colors hover:bg-(--bg-hover)"
            style={{ borderColor: "var(--border-default)", color: "var(--text-brand)" }}
          >
            See all results →
          </a>
        </div>
      ) : null}
    </div>
  );
}
