"use client";

import { useCrmBranding } from "@/components/BrandingProvider";
import { Icon } from "@/components/Icon";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
      { href: "/tasks", label: "Tasks", icon: "square_check" },
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
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-muted font-semibold text-foreground"
                    : "font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
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

function SidebarShell({ onNavigate }: { onNavigate?: () => void }) {
  const branding = useCrmBranding();
  return (
    <>
      {/* Brand header */}
      <div className="flex h-13 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            {branding.logo}
          </span>
          <div>
            <p className="text-[14px] font-bold leading-tight text-foreground">
              {branding.name}
            </p>
            <p className="text-[10px] font-medium leading-tight text-muted-foreground">
              CRM
            </p>
          </div>
        </div>
      </div>

      <NavList onNavigate={onNavigate} />

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-[10px] text-muted-foreground">
          {branding.name} v0.1
        </p>
      </div>
    </>
  );
}

/**
 * Enterprise sidebar: fixed icon+label rail on desktop with section headers;
 * shadcn Sheet (side="left") on mobile with backdrop and animation. Neutral
 * identity — the active item is a muted background with foreground text,
 * no per-module accent hues.
 */
export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="secondary"
        size="icon"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 lg:hidden"
      >
        <Icon name="menu" size={18} />
      </Button>

      {/* Mobile off-canvas drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-60 gap-0 p-0 sm:max-w-60"
          aria-label="Primary navigation"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarShell onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background lg:flex">
        <SidebarShell />
      </aside>
    </>
  );
}
