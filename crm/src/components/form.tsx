"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Input } from "@/components/ui/input";
import { SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Enterprise form primitives — the shared vocabulary every CRM form uses:
 * labeled fields with required markers and helper text, inputs with leading
 * icons, titled form sections, and a consistent action row.
 *
 * Conventions (DESIGN.md §6):
 * - Every text input gets a meaningful placeholder (an example, not the label repeated).
 * - Helper text explains WHY the field matters or its format — one line, rare.
 * - Icons: inputs take a leading icon when it aids recognition (mail, calendar,
 *   search); submit buttons always carry an icon via the Button seam.
 */

export function Field({
  id,
  label,
  required = false,
  help,
  children,
  className,
}: {
  id?: string;
  label: string;
  required?: boolean;
  /** One-line hint under the control — explains format or consequence. */
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label">
        {label}
        {required ? <span className="form-required"> *</span> : null}
      </label>
      {children}
      {help ? <p className="form-help">{help}</p> : null}
    </div>
  );
}

/** Input with a leading recognition icon (mail, calendar, search…). */
export function IconInput({
  icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: string }) {
  return (
    <div className="relative w-full">
      <Icon
        name={icon}
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-(--text-tertiary)"
      />
      <Input className={cn("pl-8", className)} {...props} />
    </div>
  );
}

/** Input with file upload capability */
export function FileInput({
  icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: string }) {
  return (
     <div className="relative w-full">
      <Icon
        name={icon}
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-(--text-tertiary)"
      />
      <Input type="file" className={cn("pl-8", className)} {...props} />
    </div>
  );
}

/** Search input — toolbar search boxes with the magnifier baked in.
 * Width classes belong on `wrapperClassName` (the visible box is the
 * wrapper; the input fills it). */
export function SearchInput({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<typeof Input> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <Icon
        name="search"
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-(--text-tertiary)"
      />
      <Input className={cn("pl-8", className)} {...props} />
    </div>
  );
}

/** SelectTrigger with a leading recognition icon — use inside a Select root. */
export function IconSelectTrigger({
  icon,
  className,
  wrapperClassName,
  children,
  ...props
}: React.ComponentProps<typeof SelectTrigger> & { icon: string; wrapperClassName?: string }) {
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <Icon
        name={icon}
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-(--text-tertiary)"
      />
      <SelectTrigger className={cn("w-full pl-8", className)} {...props}>
        {children}
      </SelectTrigger>
    </div>
  );
}

/** Titled group inside a form — use one per logical chunk of fields. */
export function FormSection({
  title,
  help,
  children,
  className,
}: {
  title: string;
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("form-section space-y-4", className)}>
      <div>
        <p className="form-section-title">{title}</p>
        {help ? <p className="form-section-help">{help}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

/** Right-aligned footer: Cancel/secondary left of the primary submit. */
export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("form-actions", className)}>{children}</div>;
}

/** Inline error banner for form-level failures. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
      {message}
    </p>
  );
}
