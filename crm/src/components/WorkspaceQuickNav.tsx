"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/leads", label: "Leads", group: "Records" },
  { href: "/contacts", label: "Contacts", group: "Records" },
  { href: "/accounts", label: "Accounts", group: "Records" },
  { href: "/customers", label: "Customers", group: "Records" },
  { href: "/opportunities", label: "Opportunities", group: "Revenue" },
  { href: "/campaigns", label: "Campaigns", group: "Growth" },
  { href: "/tasks", label: "Tasks", group: "Work" },
  { href: "/notifications", label: "Notifications", group: "Work" },
  { href: "/reports", label: "Reports", group: "Insights" },
  { href: "/search", label: "Search", group: "Find" },
  { href: "/admin", label: "Admin", group: "Control" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceQuickNav({
  backHref,
  backLabel,
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Workspace navigation"
      className="no-print rounded-2xl border border-(--border-default) bg-(--bg-surface) p-2 shadow-(--shadow-subtle)"
    >
      <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
        {backHref ? (
          <Link
            href={backHref}
            className="shrink-0 rounded-xl border border-(--border-default) bg-(--bg-subtle) px-3 py-2 text-sm font-medium text-(--text-secondary) hover:bg-(--bg-hover)"
          >
            ← {backLabel ?? "Back"}
          </Link>
        ) : null}
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm transition ${
                active
                  ? "bg-(--brand) text-white shadow-sm"
                  : "text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
              }`}
            >
              <span className={active ? "text-white/80" : "text-(--text-tertiary)"}>{item.group}</span>
              <span className="ml-2 font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
