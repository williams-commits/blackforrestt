"use client";

/**
 * Global UI primitives — the design-system layer for the CRM.
 *
 * Every multi-use interaction pattern lives here (or as a globals.css
 * class): buttons, drawers, sections, empty states, module illustrations.
 * Call sites never import lucide directly; icons flow through Icon.tsx so
 * the icon set can be re-skinned in one place.
 */

import { type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/* ════════════════════════════════════════════════════════════════
   Button — ONE global button. Variants cover the whole CRM; sizes are
   token-driven (28/32/36). Visually quiet; icons only where they add
   meaning, never decoration.
   ════════════════════════════════════════════════════════════════ */

type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const SHADCN_VARIANT: Record<ButtonVariant, "default" | "outline" | "ghost" | "destructive"> = {
  primary: "default",
  secondary: "outline",
  tertiary: "ghost",
  destructive: "destructive",
};

const SHADCN_SIZE: Record<ButtonSize, "xs" | "sm" | "default" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"> = {
  xs: "xs",
  sm: "sm",
  md: "default",
  lg: "lg",
  icon: "icon",
  "icon-xs": "icon-xs",
  "icon-sm": "icon-sm",
  "icon-lg": "icon-lg",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  type = "button",
  href,
  className = "",
  ...rest
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon name from the shared Icon set — omit for text-only buttons. */
  icon?: string;
  iconPosition?: "left" | "right";
  /** Shows the spinner, disables, and keeps the width stable. */
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  /** Renders an anchor styled as a button (navigation CTAs). */
  href?: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "type">) {
  const iconSize = size === "xs" || size === "sm" || size.startsWith("icon-") && size !== "icon-lg" ? 13 : 16;
  const classes = cn(buttonVariants({ variant: SHADCN_VARIANT[variant], size: SHADCN_SIZE[size] }), className);
  const inner = (
    <>
      {loading ? (
        <LoaderCircle size={iconSize} className="animate-spin" aria-hidden />
      ) : icon && iconPosition === "left" ? (
        <Icon name={icon} size={iconSize} />
      ) : null}
      {children}
      {!loading && icon && iconPosition === "right" ? <Icon name={icon} size={iconSize} /> : null}
    </>
  );
  if (href && !disabled && !loading) {
    return (
      <a href={href} className={classes}>
        {inner}
      </a>
    );
  }
  return (
    <button type={type} disabled={disabled || loading} className={classes} {...rest}>
      {inner}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════
   Drawer — the one side panel, now backed by shadcn's Sheet (slides in
   from the right). The caller owns form state, validation, and
   unsaved-change handling (return false from onClose to veto).
   ════════════════════════════════════════════════════════════════ */

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "md",
  label,
}: {
  open: boolean;
  title: string;
  subtitle?: string | null;
  /** Called on outside click, Esc, and the close button — veto by returning false. */
  onClose: () => boolean | void;
  children: ReactNode;
  /** Sticky footer; render Button(s) here (primary right-most). */
  footer?: ReactNode;
  width?: "md" | "lg";
  /** Accessible name when title alone is ambiguous. */
  label?: string;
}) {
  const panelWidth = width === "lg" ? "sm:max-w-2xl" : "sm:max-w-xl";
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="right"
        aria-label={label ?? title}
        className={`flex w-full flex-col gap-0 p-0 ${panelWidth}`}
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-sm font-semibold text-foreground">{title}</SheetTitle>
          {subtitle ? (
            <SheetDescription className="text-xs text-muted-foreground">{subtitle}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════
   Section — borderless grouping. Structure comes from typography and
   whitespace, not another box.
   ════════════════════════════════════════════════════════════════ */

export function Section({
  title,
  description,
  actions,
  children,
  divider = false,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  divider?: boolean;
  className?: string;
}) {
  return (
    <section className={`section ${divider ? "section-divided" : ""} ${className}`}>
      {title || actions ? (
        <div className="section-header">
          <div className="min-w-0">
            {title ? <h2 className="section-title">{title}</h2> : null}
            {description ? <p className="section-description">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════
   EmptyState — illustration + title + description + optional action.
   ════════════════════════════════════════════════════════════════ */

export function EmptyState({
  illustration,
  title,
  description,
  action,
}: {
  illustration?: ModuleIllustrationKind;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {illustration ? <ModuleIllustration kind={illustration} /> : null}
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ModuleIllustration — minimal abstract line-art for module identity
   and empty states. One stroke weight, module accent ink, quiet
   secondary strokes. Never decorative filler.
   ════════════════════════════════════════════════════════════════ */

export type ModuleIllustrationKind =
  | "leads"
  | "contacts"
  | "accounts"
  | "customers"
  | "opportunities"
  | "tasks"
  | "campaigns"
  | "reports"
  | "search";

export function ModuleIllustration({ kind, size = 96 }: { kind: ModuleIllustrationKind; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 96 96",
    fill: "none" as const,
    "aria-hidden": true,
    className: "module-illustration",
  };
  const ink = { stroke: "var(--primary)", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const soft = { stroke: "var(--border-strong)", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (kind) {
    case "leads": // a journey: waypoint, path, destination
      return (
        <svg {...common}>
          <circle cx="20" cy="26" r="6" {...soft} />
          <path d="M28 30 C 44 40, 50 56, 66 60" strokeDasharray="1 7" {...ink} strokeWidth={2} />
          <circle cx="74" cy="62" r="9" {...ink} />
          <circle cx="74" cy="62" r="3.5" fill="var(--primary)" stroke="none" />
        </svg>
      );
    case "contacts": // connected people
      return (
        <svg {...common}>
          <circle cx="34" cy="34" r="8" {...ink} />
          <circle cx="64" cy="44" r="6" {...soft} />
          <circle cx="42" cy="66" r="6" {...soft} />
          <path d="M41 38 L 59 42" {...ink} />
          <path d="M39 41 L 42 60" {...ink} />
          <path d="M58 49 L 48 61" strokeDasharray="1 6" {...soft} />
        </svg>
      );
    case "accounts": // establishment pillars
      return (
        <svg {...common}>
          <path d="M24 38 L48 22 L72 38" {...ink} />
          <path d="M30 38 V 64 M42 38 V 64 M54 38 V 64 M66 38 V 64" {...soft} />
          <path d="M22 70 H74" {...ink} />
        </svg>
      );
    case "customers": // handshake arc — two arcs meeting
      return (
        <svg {...common}>
          <path d="M18 52 C 28 36, 44 36, 50 48" {...ink} />
          <path d="M78 52 C 68 36, 52 36, 46 48" {...soft} />
          <path d="M22 58 H74" {...ink} />
          <circle cx="48" cy="30" r="3" fill="var(--primary)" stroke="none" />
        </svg>
      );
    case "opportunities": // pipeline progression
      return (
        <svg {...common}>
          <circle cx="22" cy="48" r="5" {...soft} />
          <circle cx="42" cy="42" r="7" {...soft} />
          <circle cx="64" cy="36" r="9" {...ink} />
          <path d="M26 47 L 36 44 M48 41 L 56 38" strokeDasharray="1 6" {...ink} />
          <path d="M76 28 L 80 24" {...ink} />
        </svg>
      );
    case "tasks": // checklist
      return (
        <svg {...common}>
          <path d="M30 28 L 70 28" {...ink} />
          <path d="M30 46 L 70 46" {...soft} />
          <path d="M30 64 L 54 64" {...soft} />
          <path d="M22 26 l 3 3 l 5 -6" {...ink} />
          <circle cx="22" cy="46" r="4" {...soft} />
          <circle cx="22" cy="64" r="4" {...soft} />
        </svg>
      );
    case "campaigns": // signal radiating out
      return (
        <svg {...common}>
          <circle cx="36" cy="60" r="7" {...ink} />
          <path d="M46 50 A 16 16 0 0 1 46 70" {...ink} />
          <path d="M54 42 A 26 26 0 0 1 54 78" strokeDasharray="1 6" {...soft} />
          <path d="M62 34 A 36 36 0 0 1 62 86" strokeDasharray="1 6" {...soft} />
        </svg>
      );
    case "reports": // bars + trend
      return (
        <svg {...common}>
          <path d="M28 62 V 46 M40 62 V 34 M52 62 V 52 M64 62 V 40" {...ink} />
          <path d="M22 68 H74" {...soft} />
          <path d="M30 40 L 44 30 L 58 44 L 70 26" strokeDasharray="1 6" {...soft} />
        </svg>
      );
    case "search": // magnifier over lines
      return (
        <svg {...common}>
          <circle cx="44" cy="42" r="16" {...ink} />
          <path d="M56 54 L 68 66" {...ink} strokeWidth={2} />
          <path d="M36 38 H 52 M36 46 H 48" {...soft} />
        </svg>
      );
  }
}
