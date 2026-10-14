"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** shadcn-pattern alert. `tone` picks the semantic color set and default
 *  icon; pass children to replace the icon. */
const alertVariants = cva(
  "relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 rounded-lg px-4 py-3 text-sm has-[>svg]:grid-cols-[auto_1fr] [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      tone: {
        ok: "bg-(--term-success-bg) text-(--term-success-fg)",
        err: "bg-(--term-danger-bg) text-(--term-danger-fg)",
        info: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

function Alert({
  className,
  tone = "info",
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants> & { icon?: React.ReactNode }) {
  return (
    <div
      role={tone === "err" ? "alert" : "status"}
      data-slot="alert"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {icon ?? (tone === "ok" ? <CheckCircle2 aria-hidden /> : tone === "err" ? <AlertCircle aria-hidden /> : <Info aria-hidden />)}
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}

export { Alert, alertVariants };
