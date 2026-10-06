"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RecordWorkspaceType = "leads" | "contacts" | "accounts" | "customers" | "opportunities" | "tasks" | "campaigns";

interface WorkspaceTab {
  id: string;
  label: string;
  subtitle?: string | null;
  href: string;
  openedAt: number;
  type?: RecordWorkspaceType;
}

const TYPE_ICON: Record<RecordWorkspaceType, string> = {
  leads: "target",
  contacts: "users",
  accounts: "building",
  customers: "heart",
  opportunities: "trending",
  tasks: "square_check",
  campaigns: "megaphone",
};

const MAX_TABS = 12;
const STORAGE_PREFIX = "crm-record-tabs:v2";
const OLD_STORAGE_PREFIX = "crm-record-tabs";

function storageKey(type: RecordWorkspaceType) {
  return `${STORAGE_PREFIX}:${type}`;
}

function removeOldStoredTabs() {
  for (const type of ["leads", "contacts", "accounts", "customers", "opportunities", "tasks", "campaigns"] satisfies RecordWorkspaceType[]) {
    localStorage.removeItem(`${OLD_STORAGE_PREFIX}:${type}`);
  }
}

function readTabs(type: RecordWorkspaceType): WorkspaceTab[] {
  try {
    const raw = sessionStorage.getItem(storageKey(type));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspaceTab[];
    if (!Array.isArray(parsed)) return [];
    const validTabs = parsed.filter((tab) => {
      if (!tab || typeof tab.id !== "string" || typeof tab.href !== "string") return false;
      if (tab.type !== type) return false;
      return tab.href === `/${type}/${tab.id}`;
    });
    if (validTabs.length !== parsed.length) writeTabs(type, validTabs);
    return validTabs;
  } catch {
    sessionStorage.removeItem(storageKey(type));
    return [];
  }
}

function writeTabs(type: RecordWorkspaceType, tabs: WorkspaceTab[]) {
  sessionStorage.setItem(storageKey(type), JSON.stringify(tabs.slice(0, MAX_TABS)));
}

function canonicalHref(type: RecordWorkspaceType, id: string) {
  return `/${type}/${id}`;
}

/**
 * Workspace banner above record pages: session quick tabs for the records
 * you have open in this module (click to switch, hover for close) plus a
 * dropdown of tab actions. The active tab carries the brand accent.
 */
export function RecordWorkspaceTabs({
  type,
  typeLabel,
  id,
  label,
  subtitle,
}: {
  type: RecordWorkspaceType;
  typeLabel: string;
  id: string;
  label: string;
  subtitle?: string | null;
  href?: string;
}) {
  const router = useRouter();
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);

  useEffect(() => {
    removeOldStoredTabs();
    const current: WorkspaceTab = { id, label, subtitle, href: canonicalHref(type, id), openedAt: Date.now(), type };
    const next = [current, ...readTabs(type).filter((tab) => tab.id !== id)].slice(0, MAX_TABS);
    writeTabs(type, next);
    setTabs(next);
  }, [id, label, subtitle, type]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === storageKey(type)) setTabs(readTabs(type));
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [type]);

  function removeTab(tabId: string) {
    const next = tabs.filter((tab) => tab.id !== tabId);
    writeTabs(type, next);
    setTabs(next);
    if (tabId === id) {
      router.push(next[0]?.href ?? `/${type}`);
    }
  }

  function clearTabs() {
    writeTabs(type, []);
    setTabs([]);
  }

  return (
    <section
      className="no-print w-full rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-xs"
      aria-label={`${typeLabel} workspace tabs`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon name={TYPE_ICON[type]} size={14} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] leading-tight text-muted-foreground">
                Open {typeLabel}
              </p>
              <p className="truncate text-xs leading-tight text-muted-foreground/80">
                {tabs.length} record{tabs.length === 1 ? "" : "s"} in this session · click a tab to switch
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="tertiary"
                size="icon-sm"
                aria-label={`${typeLabel} tab actions`}
                title={`${typeLabel} tab actions`}
                className="shrink-0"
              >
                <Icon name="more" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={() => {
                  removeTab(id);
                }}
              >
                <span className="flex items-center gap-2">
                  <Icon name="close" size={14} className="text-muted-foreground" />
                  Close current tab
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  clearTabs();
                  router.push(`/${type}`);
                }}
              >
                <span className="flex items-center gap-2">
                  <Icon name="list" size={14} className="text-muted-foreground" />
                  Clear and go back
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={clearTabs}>
                <span className="flex items-center gap-2">
                  <Icon name="trash" size={14} className="text-muted-foreground" />
                  Clear all {typeLabel.toLowerCase()} tabs
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* quick tabs: one scrolling row; close reveals on hover (touch always shows it) */}
        <div className="flex items-stretch gap-1.5 overflow-x-auto pb-0.5" role="list">
          {tabs.map((tab) => {
            const active = tab.id === id;
            return (
              <div
                key={tab.id}
                role="listitem"
                className={cn(
                  "group flex min-w-40 max-w-60 shrink-0 items-stretch overflow-hidden rounded-md border transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-muted/40 hover:bg-muted"
                )}
              >
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1.5 pl-2.5 pr-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active && "pointer-events-none"
                  )}
                >
                  <span
                    className={cn(
                      "truncate text-[13px] font-semibold leading-tight",
                      active ? "text-primary" : "text-foreground"
                    )}
                  >
                    {tab.label}
                  </span>
                  {tab.subtitle ? (
                    <span className="truncate text-[10px] leading-tight text-muted-foreground">
                      {tab.subtitle}
                    </span>
                  ) : null}
                </Link>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    removeTab(tab.id);
                  }}
                  aria-label={`Close ${tab.label}`}
                  title={`Close ${tab.label}`}
                  className={cn(
                    "flex w-6 shrink-0 items-center justify-center rounded-r-md transition-all",
                    active
                      ? "text-primary/70 hover:bg-primary/10 hover:text-primary"
                      : "text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-100"
                  )}
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
