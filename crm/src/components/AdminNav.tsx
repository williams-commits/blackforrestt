"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Admin section navigation — a left sidebar listing all admin functions,
 * visually separated from daily CRM work per the enterprise spec.
 */
const ADMIN_NAV = [
  { href: "/admin/statuses", label: "Statuses", icon: "tag" },
  { href: "/admin/tags", label: "Tags", icon: "labels" },
  { href: "/admin/fields", label: "Custom Fields", icon: "grid" },
  { href: "/admin/people", label: "Users & Teams", icon: "users" },
  { href: "/admin/roles", label: "Roles & Permissions", icon: "shield" },
  { href: "/admin/objects", label: "Custom Objects", icon: "box" },
  { href: "/admin/settings", label: "Settings", icon: "sliders" },
  { href: "/admin/integrations", label: "Integrations", icon: "plug" },
  { href: "/admin/audit", label: "Audit Log", icon: "file-text" },
];

function NavIcon({ name }: { name: string }) {
  const size = 16;
  const stroke = { strokeWidth: 2, fill: "none", stroke: "currentColor" as const };
  switch (name) {
    case "tag": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.83z"/><circle cx="7" cy="7" r="1"/></svg>;
    case "labels": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.83z"/></svg>;
    case "grid": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case "users": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
    case "shield": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case "box": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>;
    case "sliders": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
    case "plug": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 01-4 4h-4a4 4 0 01-4-4V8z"/></svg>;
    case "file-text": return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    default: return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="10"/></svg>;
  }
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="w-52 shrink-0 space-y-0.5" aria-label="Administration">
      <p
        className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-tertiary)" }}
      >
        Administration
      </p>
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors"
            style={{
              color: active ? "var(--brand-700)" : "var(--text-secondary)",
              background: active ? "var(--brand-50)" : "transparent",
            }}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
