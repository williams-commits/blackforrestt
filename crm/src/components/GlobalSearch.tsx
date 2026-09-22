"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
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

/** Global search: enterprise bar with `/` shortcut opening a shadcn command
 *  palette; results are fetched server-side (debounced) and grouped by type. */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // `/` opens the search palette (Salesforce-style shortcut)
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const grouped = new Map<string, Hit[]>();
  for (const type of TYPE_ORDER) {
    const list = hits.filter((hit) => hit.objectType === type);
    if (list.length > 0) grouped.set(type, list);
  }

  function seeAllResults() {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
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
        <span className="truncate">Search…</span>
        <kbd className="ml-auto rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">/</kbd>
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
            placeholder="Search… (press / )"
            onKeyDown={(event) => {
              // Enter with no matching records falls through to the full
              // search page (the original header-bar behavior).
              if (event.key === "Enter" && query.trim().length >= 2 && hits.length === 0) {
                seeAllResults();
              }
            }}
          />
          <CommandList>
            {loading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : query.trim().length >= 2 && hits.length === 0 ? (
              <CommandEmpty>No matches in your scope.</CommandEmpty>
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
                  <CommandItem onSelect={seeAllResults}>
                    See all results →
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
}
