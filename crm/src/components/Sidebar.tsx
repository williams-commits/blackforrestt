"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "",
    items: [{ href: "/", label: "Home", icon: "home" }],
  },
  {
    label: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: "target" },
      { href: "/contacts", label: "Contacts", icon: "users" },
      { href: "/accounts", label: "Accounts", icon: "building" },
      { href: "/customers", label: "Customers", icon: "heart" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/opportunities", label: "Opportunities", icon: "trending-up" },
      { href: "/campaigns", label: "Campaigns", icon: "megaphone" },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/tasks", label: "Tasks", icon: "check-square" },
      { href: "/imports", label: "Import", icon: "upload" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: "bar-chart" },
      { href: "/search", label: "Search", icon: "search" },
      { href: "/docs", label: "Documentation", icon: "file-text" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin", label: "Administration", icon: "settings" }],
  },
];

/** Inline SVG icon set (16px, Lucide-inspired). */
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
    target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
    users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /></>,
    heart: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />,
    "trending-up": <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    megaphone: <path d="M3 11l18-5v12L3 14v-3z" />,
    "check-square": <><polyline points="9 11 12 14 22 4" /><path d="M21 14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></>,
    upload: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    "bar-chart": <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    "file-text": <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" /></>,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      {paths[name] ?? paths.home}
    </svg>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Primary">
      {NAV_SECTIONS.map((section, sectionIndex) => (
        <div key={sectionIndex} className={sectionIndex > 0 ? "mt-3" : ""}>
          {section.label ? (
            <p
              className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors"
                style={{
                  color: active ? "var(--brand-700)" : "var(--text-secondary)",
                  background: active ? "var(--brand-50)" : "transparent",
                }}
                onMouseEnter={(event) => {
                  if (!active) event.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(event) => {
                  if (!active) event.currentTarget.style.background = "transparent";
                }}
              >
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
                {active ? (
                  <span
                    className="ml-auto rounded-full"
                    style={{ width: 6, height: 6, background: "var(--brand-500)" }}
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Enterprise sidebar: fixed icon+label rail on desktop with section headers;
 * off-canvas drawer on mobile with backdrop and animation.
 */
export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-surface)",
          color: "var(--text-secondary)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Backdrop */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-surface)",
        }}
      >
        {/* Brand header */}
        <div
          className="flex h-[52px] items-center justify-between border-b px-4"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: "var(--brand)", color: "var(--text-inverse)" }}
            >
              BF
            </span>
            <div>
              <p className="text-[14px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                Black Forest
              </p>
              <p className="text-[10px] font-medium leading-tight" style={{ color: "var(--text-tertiary)" }}>
                CRM
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="text-lg lg:hidden"
            style={{ color: "var(--text-tertiary)" }}
          >
            ×
          </button>
        </div>

        <NavList onNavigate={() => setOpen(false)} />

        {/* Footer */}
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "var(--border-default)" }}
        >
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            Black Forest CRM v0.1
          </p>
        </div>
      </aside>
    </>
  );
}
