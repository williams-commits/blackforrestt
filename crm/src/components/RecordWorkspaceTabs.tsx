"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

type RecordWorkspaceType = "leads" | "contacts" | "accounts" | "customers" | "opportunities";

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
  for (const type of ["leads", "contacts", "accounts", "customers", "opportunities"] satisfies RecordWorkspaceType[]) {
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    removeOldStoredTabs();
    const current: WorkspaceTab = { id, label, subtitle, href: canonicalHref(type, id), openedAt: Date.now(), type };
    const next = [current, ...readTabs(type).filter((tab) => tab.id !== id)].slice(0, MAX_TABS);
    writeTabs(type, next);
    setTabs(next);
  }, [id, label, subtitle, type]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === storageKey(type)) setTabs(readTabs(type));
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
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
    setMenuOpen(false);
  }

  return (
    <section className="record-workspace-tabs no-print" aria-label={`${typeLabel} workspace tabs`}>
      <div className="record-workspace-tabs-header">
        <div className="min-w-0">
          <p className="record-workspace-tabs-eyebrow">Open {typeLabel}</p>
          <p className="record-workspace-tabs-count">{tabs.length} quick tab{tabs.length === 1 ? "" : "s"}</p>
        </div>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            className="record-workspace-tabs-menu"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`${typeLabel} tab actions`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={`${typeLabel} tab actions`}
          >
            <Icon name="more" size={16} />
          </button>
          {menuOpen ? (
            <div className="record-workspace-tabs-dropdown" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  removeTab(id);
                  setMenuOpen(false);
                }}
              >
                Close current tab
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  clearTabs();
                  router.push(`/${type}`);
                }}
              >
                Clear and go back
              </button>
              <button type="button" role="menuitem" onClick={clearTabs}>
                Clear all {typeLabel.toLowerCase()} tabs
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="record-workspace-tabs-list" role="list">
        {tabs.map((tab) => {
          const active = tab.id === id;
          return (
            <div key={tab.id} className={`record-workspace-tab ${active ? "active" : ""}`} role="listitem">
              <Link href={tab.href} className="record-workspace-tab-link" aria-current={active ? "page" : undefined}>
                <span className="record-workspace-tab-title">{tab.label}</span>
                {tab.subtitle ? <span className="record-workspace-tab-subtitle">{tab.subtitle}</span> : null}
              </Link>
              <button
                type="button"
                className="record-workspace-tab-close"
                onClick={(event) => {
                  event.preventDefault();
                  removeTab(tab.id);
                }}
                aria-label={`Close ${tab.label}`}
                title={`Close ${tab.label}`}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
