"use client";

/**
 * Global UI primitives — the design-system layer for the CRM.
 *
 * Every multi-use interaction pattern lives here (or as a globals.css
 * class): buttons, drawers, sections, empty states.
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

/* EmptyState + ModuleIllustration now live as shadcn-style primitives in
   ui/empty-state.tsx; re-exported here so
   every existing `@/components/ui` import keeps working. */

export { EmptyState } from "@/components/ui/empty-state";
