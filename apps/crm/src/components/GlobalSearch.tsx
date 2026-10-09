"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { readRecent, type RecentRecord } from "@/components/RecentRecords";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { type SearchScope } from "@/lib/searchPalette";
import { cn } from "@/lib/utils";

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

/** Scope chips: ALL + the objects a palette can be opened pre-scoped to
 *  (module toolbars). Opportunities/Notes stay result-only (no chip) —
 *  they have no list-page toolbar to open from. */
const SCOPES: Array<{ value: SearchScope; label: string; listPath?: string }> = [
  { value: "ALL", label: "All" },
  { value: "LEAD", label: "Leads", listPath: "/leads" },
  { value: "CONTACT", label: "Contacts", listPath: "/contacts" },
  { value: "ACCOUNT", label: "Accounts", listPath: "/accounts" },
  { value: "CUSTOMER", label: "Customers", listPath: "/customers" },
  { value: "CAMPAIGN", label: "Campaigns", listPath: "/campaigns" },
  { value: "TASK", label: "Tasks", listPath: "/tasks" },
];

/** Global search: enterprise bar with `/` and ⌘K shortcuts opening a shadcn
 *  command palette; results are fetched server-side (debounced) and grouped
 *  by type. Any surface can open it pre-scoped via openSearchPalette(). */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<SearchScope>("ALL");
  const [recents, setRecents] = useState<RecentRecord[]>([]);

  // Scoped searches keep every hit relevant, so ask the server for a deeper
  // per-type slice than the global 5.
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (scope !== "ALL") params.set("perType", "10");
        const response = await fetch(`/api/search?${params}`);
        if (response.ok) {
          setHits((await response.json()).data);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, scope]);

  // Recents fill the palette when the query is empty — refreshed on every
  // open and whenever a record visit rewrites the store.
  useEffect(() => {
    if (!open) return;
    const refresh = () => setRecents(readRecent());
    refresh();
    window.addEventListener("crm:recent-records-refresh", refresh);
    return () => window.removeEventListener("crm:recent-records-refresh", refresh);
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "") ||
        target?.isContentEditable === true ||
        target?.closest?.('[role="textbox"]') != null;
      // ⌘K/Ctrl+K works everywhere (modifier combos never type characters);
      // `/` opens only outside form fields and contenteditable editors
      // (notes, comments, email bodies) must receive the character untouched.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    }
    // External surfaces (module toolbars, sidebar) open the palette pre-scoped.
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<{ scope?: SearchScope }>).detail;
      if (detail?.scope) setScope(detail.scope);
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("crm:open-search", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("crm:open-search", onOpen);
    };
  }, []);

  const visibleHits = scope === "ALL" ? hits : hits.filter((hit) => hit.objectType === scope);
  const grouped = new Map<string, Hit[]>();
  for (const type of TYPE_ORDER) {
    const list = visibleHits.filter((hit) => hit.objectType === type);
    if (list.length > 0) grouped.set(type, list);
  }
  const activeScope = SCOPES.find((s) => s.value === scope);
  const showResultsInTable = scope !== "ALL" && activeScope?.listPath && query.trim().length >= 2;

  function seeAllResults() {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function showInModuleTable() {
    if (!activeScope?.listPath) return;
    const objectKey = activeScope.listPath.slice(1);
    const q = query.trim();
    setOpen(false);
    // Same-page navigations don't remount the list (so its mount-time ?q
    // read never fires) — a paired event covers that case; the push keeps
    // the URL deep-linkable and handles cross-page opens.
    window.dispatchEvent(new CustomEvent("crm:module-search", { detail: { object: objectKey, q } }));
    router.push(`${activeScope.listPath}?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="relative w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Global search"
        className="flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-[13px] text-muted-foreground transition-colors outline-none select-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
      >
        <Icon name="search" size={14} className="shrink-0 opacity-50" />
        <span className="truncate">Search CRM…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline">/</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Global search"
        description="Search records within your scope"
      >
        {/* Server is the filter: the API searches every column + relation
            (ILIKE over emails, owners, subtitles…), so cmdk's local label
            filter must be disabled entirely or it hides valid server hits. */}
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={scope === "ALL" ? "Search CRM…" : `Search ${TYPE_LABELS[scope].toLowerCase()}…`}
            onKeyDown={(event) => {
              // Enter with no matching records falls through to the full
              // search page (the original header-bar behavior); scoped, it
              // filters the module table instead.
              if (event.key === "Enter" && query.trim().length >= 2 && visibleHits.length === 0) {
                if (showResultsInTable) showInModuleTable();
                else seeAllResults();
              }
            }}
          />
          <div
            className="flex gap-1 overflow-x-auto border-b border-border px-3 pb-2"
            role="tablist"
            aria-label="Search scope"
          >
            {SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={scope === option.value}
                onClick={() => setScope(option.value)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  scope === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <CommandList>
            {loading ? (
              <p className="flex items-center justify-center gap-2 px-2 py-4 text-center text-sm text-muted-foreground">
                <Icon name="loader" size={14} className="shrink-0 opacity-50 animate-spin" /> Searching…
              </p>
            ) : query.trim().length >= 2 && visibleHits.length === 0 ? (
              <CommandEmpty>No matches in your scope.</CommandEmpty>
            ) : query.trim().length < 2 && recents.length > 0 ? (
              <CommandGroup heading="Recent">
                {recents.map((record) => (
                  <CommandItem
                    key={record.href}
                    onSelect={() => {
                      setOpen(false);
                      router.push(record.href);
                    }}
                  >
                    <span className="truncate font-medium">{record.label}</span>
                    <span className="ml-auto shrink-0 truncate text-[11px] text-muted-foreground">
                      {record.module}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              [...grouped.entries()].map(([type, list]) => (
                <CommandGroup
                  key={type}
                  heading={`${TYPE_LABELS[type] ?? type.toLowerCase()} (${list.length})`}
                >
                  {list.map((hit) => (
                    <CommandItem
                      key={`${hit.objectType}-${hit.id}`}
                      onSelect={() => {
                        setOpen(false);
                        router.push(hit.url);
                      }}
                    >
                      <span className="truncate font-medium">{hit.label}</span>
                      <span className="ml-auto shrink-0 truncate text-[11px] text-muted-foreground">
                        {hit.subtitle}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
            {query.trim().length >= 2 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  {showResultsInTable ? (
                    <CommandItem onSelect={showInModuleTable}>
                      Show results in {TYPE_LABELS[scope].toLowerCase()} table →
                    </CommandItem>
                  ) : null}
                  <CommandItem onSelect={seeAllResults}>See all results →</CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
}
