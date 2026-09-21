"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

/**
 * Admin section navigation — a grouped left rail listing all admin
 * functions, visually separated from daily CRM work per the enterprise
 * spec. Entries are permission-gated: the core record tabs are always
 * visible (they render read-only without SETTINGS_MANAGE), the system
 * surfaces require it, and the audit log requires AUDIT_VIEW.
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
    <nav className="admin-rail" aria-label="Administration">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) =>
            (!("manageOnly" in item && item.manageOnly) || canManage) &&
            (!("auditOnly" in item && item.auditOnly) || canAudit),
        );
        if (items.length === 0) return null;
        return (
          <div className="admin-nav-group" key={group.label}>
            <span className="admin-nav-group-label">{group.label}</span>
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`admin-nav-item ${active ? "active" : ""}`}
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
