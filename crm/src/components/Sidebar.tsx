"use client";

import { useCrmBranding } from "@/components/BrandingProvider";
import { Icon } from "@/components/Icon";
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
      { href: "/opportunities", label: "Opportunities", icon: "trending" },
      { href: "/campaigns", label: "Campaigns", icon: "megaphone" },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/tasks", label: "Tasks", icon: "check" },
      { href: "/emails", label: "Emails", icon: "mail" },
      { href: "/imports", label: "Import", icon: "upload" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: "chart" },
      { href: "/search", label: "Search", icon: "search" },
      { href: "/docs", label: "Documentation", icon: "file" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin", label: "Administration", icon: "settings" }],
  },
];

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
                  color: active ? "var(--text-brand)" : "var(--text-secondary)",
                  background: active ? "var(--bg-selected)" : "transparent",
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
  const branding = useCrmBranding();
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
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-surface)",
        }}
      >
        {/* Brand header */}
        <div
          className="flex h-13 items-center justify-between border-b px-4"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: "var(--brand)", color: "var(--text-inverse)" }}
            >
              {branding.logo}
            </span>
            <div>
              <p className="text-[14px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {branding.name}
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
            className="text-lg lg:hidden text-(--text-tertiary)"
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
          <p className="text-[10px] text-(--text-tertiary)">
            {branding.name} v0.1
          </p>
        </div>
      </aside>
    </>
  );
}
