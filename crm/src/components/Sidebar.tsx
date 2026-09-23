"use client";

import { useCrmBranding } from "@/components/BrandingProvider";
import { Icon } from "@/components/Icon";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarCollapse } from "@/components/SidebarCollapse";
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

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Primary">
      {NAV_SECTIONS.map((section, sectionIndex) => (
        <div key={sectionIndex} className={sectionIndex > 0 ? "mt-3" : ""}>
          {!collapsed && section.label ? (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-md text-[13px] transition-colors",
                  collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon name={item.icon} size={16} className="shrink-0" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : link;
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarShell({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const branding = useCrmBranding();
  return (
    <>
      {/* Brand header */}
      <div
        className={cn(
          "flex h-13 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            {branding.logo}
          </span>
          {collapsed ? null : (
            <div>
              <p className="text-[14px] font-bold leading-tight text-foreground">
                {branding.name}
              </p>
              <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                CRM
              </p>
            </div>
          )}
        </div>
      </div>

      <NavList onNavigate={onNavigate} collapsed={collapsed} />

      {/* Footer */}
      {collapsed ? null : (
        <div className="border-t border-border px-4 py-3">
          <p className="text-[10px] text-muted-foreground">
            {branding.name} v0.1
          </p>
        </div>
      )}
    </>
  );
}

/**
 * Enterprise sidebar: fixed icon+label rail on desktop with section headers,
 * collapsible to an icon-only rail via the top-bar toggle (see
 * SidebarCollapse); shadcn Sheet (side="left") on mobile with backdrop and
 * animation — the mobile sheet always shows full labels. The active item
 * carries the brand accent (primary tint + primary text) so the green
 * identity echoes in navigation; everything else stays neutral.
 */
export function Sidebar() {
  const [open, setOpen] = useState(false);
  const { collapsed } = useSidebarCollapse();
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

      {/* Desktop rail — data-slot scopes the pre-hydration collapse CSS */}
      <TooltipProvider delayDuration={0}>
        <aside
          data-slot="sidebar-rail"
          className={cn(
            "hidden shrink-0 flex-col overflow-hidden border-r border-border bg-background transition-[width] duration-200 ease-in-out lg:flex",
            collapsed ? "w-14" : "w-60"
          )}
        >
          <SidebarShell collapsed={collapsed} />
        </aside>
      </TooltipProvider>
    </>
  );
}
