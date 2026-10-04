"use client";

/**
 * Highlights panel — the Salesforce-signature colored strip at the top of
 * every record page showing the 4–6 most important fields at a glance.
 *
 * Collapsible: the chevron in the banner header hides/shows the field grid.
 * The choice persists per record for the browser session (sessionStorage),
 * matching the tab-session behavior — a refresh reopens the banner exactly
 * as it was left. The header row (title, badge, record actions) always
 * stays visible.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/Icon";
import { readTabSession, writeTabSession } from "@/components/useTabSession";

export function HighlightsPanel({
  title,
  badge,
  fields,
  children,
}: {
  title: string;
  badge?: { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" | "brand"; color?: string | null };
  fields: Array<{ label: string; value: React.ReactNode }>;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const storageKey = `highlight:${pathname}`;
  const [collapsed, setCollapsed] = useState(false);

  // Restore after mount (SSR-safe): a record left collapsed reopens collapsed.
  useEffect(() => {
    setCollapsed(readTabSession(storageKey, (value) => value === "collapsed") === "collapsed");
  }, [storageKey]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      writeTabSession(storageKey, next ? "collapsed" : "expanded");
      return next;
    });
  }

  const collapsible = fields.length > 0;

  return (
    <div className="highlights no-print">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: "color-mix(in srgb, var(--primary) 14%, transparent)", color: "var(--primary)" }}>
              {title.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <h1 className="highlights-title truncate">{title}</h1>
            {badge ? (
              <Badge
                className={`border-transparent text-[11px] ${
                  badge.color
                    ? "text-white"
                    : // No explicit color — neutral chip that stays visible on the
                      // accent-soft strip in BOTH themes (white-alpha vanishes on light).
                      "bg-foreground/10 text-foreground dark:bg-white/15 dark:text-white"
                }`}
                style={badge.color ? { background: badge.color, boxShadow: "0 0 0 1px rgba(255,255,255,0.35)" } : undefined}
              >
                {badge.label}
              </Badge>
            ) : null}
          </div>
          {fields.length > 0 && !collapsed ? (
            <div
              className="mt-4 grid gap-x-6 gap-y-3 border-t pt-3 animate-fade"
              style={{ borderColor: "var(--accent-border)", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
            >
              {fields.map((field) => (
                <div key={field.label} className="highlights-field">
                  <span className="highlights-label">{field.label}</span>
                  <span className="highlights-value truncate">{field.value ?? "—"}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          {children ? children : null}
          {collapsible ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Show record details" : "Hide record details"}
              title={collapsed ? "Show record details" : "Hide record details"}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon name={collapsed ? "chevron_down" : "chevron_up"} size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
