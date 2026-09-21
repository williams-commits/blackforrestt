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
  /** Module accent key — the active item takes this hue (see globals.css). */
  module?: string;
}

/** Same restrained hues as [data-module] in globals.css, mirrored for the
 * sidebar's inline active-state (the sidebar sits outside page roots). */
const MODULE_ACCENT_HEX: Record<string, string> = {
  leads: "#15803d",
  contacts: "#2563eb",
  accounts: "#4f46e5",
  customers: "#0d9488",
  opportunities: "#b45309",
  campaigns: "#be185d",
  tasks: "#7c3aed",
  emails: "#0e7490",
  reports: "#475569",
  admin: "#334155",
};

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "",
    items: [{ href: "/", label: "Home", icon: "home" }],
  },
  {
    label: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: "target", module: "leads" },
      { href: "/contacts", label: "Contacts", icon: "users", module: "contacts" },
      { href: "/accounts", label: "Accounts", icon: "building", module: "accounts" },
      { href: "/customers", label: "Customers", icon: "heart", module: "customers" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/opportunities", label: "Opportunities", icon: "trending", module: "opportunities" },
      { href: "/campaigns", label: "Campaigns", icon: "megaphone", module: "campaigns" },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/tasks", label: "Tasks", icon: "square_check", module: "tasks" },
      { href: "/emails", label: "Emails", icon: "mail", module: "emails" },
      { href: "/imports", label: "Import", icon: "upload" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: "chart", module: "reports" },
      { href: "/search", label: "Search", icon: "search" },
      { href: "/docs", label: "Documentation", icon: "file" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin", label: "Administration", icon: "settings", module: "admin" }],
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
            // Active items carry their module's accent — subtle identity,
            // the same hues the page itself uses.
            const accent = active && item.module ? (MODULE_ACCENT_HEX[item.module] ?? "var(--brand-700)") : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors"
                style={{
                  color: active ? (accent ?? "var(--text-brand)") : "var(--text-secondary)",
                  background: active
                    ? accent
                      ? `color-mix(in srgb, ${accent} 9%, transparent)`
                      : "var(--bg-selected)"
                    : "transparent",
                  boxShadow: active && accent ? `inset 2.5px 0 0 ${accent}` : undefined,
                  fontWeight: active ? 600 : 500,
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
        <Icon name="menu" size={18} />
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
            className="icon-button lg:hidden"
          >
            <Icon name="close" size={16} />
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
