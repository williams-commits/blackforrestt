"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Hit {
  objectType: string;
  id: string;
  label: string;
  subtitle: string | null;
  url: string;
}

/** Header search: debounced dropdown with grouped results + full page. */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const grouped = new Map<string, Hit[]>();
  for (const hit of hits) {
    const list = grouped.get(hit.objectType) ?? [];
    list.push(hit);
    grouped.set(hit.objectType, list);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <input
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
        placeholder="Search leads, contacts, accounts…"
        className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-[var(--brand)] focus:outline-none"
      />
      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-3 text-sm text-stone-400">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-stone-400">No matches in your scope.</p>
          ) : (
            [...grouped.entries()].map(([type, list]) => (
              <div key={type}>
                <p className="bg-stone-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  {type.toLowerCase()}s
                </p>
                {list.map((hit) => (
                  <a
                    key={`${hit.objectType}-${hit.id}`}
                    href={hit.url}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-stone-50"
                  >
                    <span className="font-medium">{hit.label}</span>
                    <span className="ml-2 truncate text-xs text-stone-400">{hit.subtitle}</span>
                  </a>
                ))}
              </div>
            ))
          )}
          <a
            href={`/search?q=${encodeURIComponent(query.trim())}`}
            onClick={() => setOpen(false)}
            className="block border-t border-stone-100 px-3 py-2 text-center text-xs font-medium text-[var(--brand)] hover:bg-stone-50"
          >
            See all results →
          </a>
        </div>
      ) : null}
    </div>
  );
}
