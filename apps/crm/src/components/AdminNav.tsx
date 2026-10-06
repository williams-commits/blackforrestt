"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

/**
 * Admin section navigation — a grouped left rail listing all admin
 * functions, visually separated from daily CRM work per the enterprise
 * spec. Entries are permission-gated: the core record tabs are always
 * visible (they render read-only without SETTINGS_MANAGE), the system
 * surfaces require it, and the audit log requires AUDIT_VIEW. Neutral
 * identity — active items are a muted background with foreground text,
 * no accent bars or hues.
 */
const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { href: "/admin/people", label: "Users & teams", icon: "users" },
      { href: "/admin/roles", label: "Roles & permissions", icon: "shield", manageOnly: true },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/admin/statuses", label: "Statuses", icon: "sliders" },
      { href: "/admin/fields", label: "Custom fields", icon: "grid" },
      { href: "/admin/tags", label: "Tags", icon: "tag" },
      { href: "/admin/objects", label: "Custom objects", icon: "box", manageOnly: true },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/integrations", label: "Integrations", icon: "plug", manageOnly: true },
      { href: "/admin/settings", label: "Settings", icon: "settings", manageOnly: true },
      { href: "/admin/audit", label: "Audit log", icon: "file", auditOnly: true },
    ],
  },
] as const;

export function AdminNav({ canManage, canAudit }: { canManage: boolean; canAudit: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Administration"
      className="sticky top-[calc(var(--topbar-height)+1rem)] flex flex-col gap-1 rounded-xl bg-card p-2 ring-1 ring-foreground/10 max-lg:static max-lg:flex-row max-lg:overflow-x-auto"
    >
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) =>
            (!("manageOnly" in item && item.manageOnly) || canManage) &&
            (!("auditOnly" in item && item.auditOnly) || canAudit),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="flex flex-col gap-0.5 py-1 max-lg:flex-row max-lg:items-center">
            <span className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground max-lg:hidden">
              {group.label}
            </span>
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8.5 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon name={item.icon} size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
