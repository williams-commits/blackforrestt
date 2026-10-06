"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", group: "Workspace" },
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
      className="no-print rounded-2xl border border-border bg-background p-2 shadow-sm lg:hidden"
    >
      <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
        {backHref ? (
          <Link
            href={backHref}
            className="shrink-0 rounded-xl border border-border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className={active ? "text-muted-foreground" : "text-muted-foreground/70"}>{item.group}</span>
              <span className="ml-2 font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
