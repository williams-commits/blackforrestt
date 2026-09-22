"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
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
    <section className="no-print flex w-full flex-col gap-2" aria-label={`${typeLabel} workspace tabs`}>
      <div className="record-workspace-tabs-header">
        <div className="min-w-0">
          <p className="record-workspace-tabs-eyebrow">Open {typeLabel}</p>
          <p className="record-workspace-tabs-count">{tabs.length} quick tab{tabs.length === 1 ? "" : "s"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="record-workspace-tabs-menu"
            aria-label={`${typeLabel} tab actions`}
            title={`${typeLabel} tab actions`}
          >
            <Icon name="more" size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onSelect={() => {
                removeTab(id);
              }}
            >
              Close current tab
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                clearTabs();
                router.push(`/${type}`);
              }}
            >
              Clear and go back
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={clearTabs}>
              Clear all {typeLabel.toLowerCase()} tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* tab-strip wraps by default; quick tabs stay on one scrolling row */}
      <div className="tab-strip w-full overflow-x-auto" style={{ flexWrap: "nowrap" }} role="list">
        {tabs.map((tab) => {
          const active = tab.id === id;
          return (
            <div key={tab.id} className="flex min-w-42.5 max-w-60 items-center" role="listitem">
              <Link href={tab.href} className={`tab-strip-button min-w-0 flex-1 text-left ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                <span className="record-workspace-tab-title">{tab.label}</span>
                {tab.subtitle ? <span className="record-workspace-tab-subtitle">{tab.subtitle}</span> : null}
              </Link>
              <Button
                variant="tertiary"
                size="sm"
                className="w-7 shrink-0 self-center px-0"
                onClick={(event) => {
                  event.preventDefault();
                  removeTab(tab.id);
                }}
                aria-label={`Close ${tab.label}`}
                title={`Close ${tab.label}`}
              >
                <Icon name="close" size={14} />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
