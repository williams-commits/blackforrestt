import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/*
  Badge on the repo's shadcn/cva structure. Besides the stock variants
  (default/secondary/outline), the terminal's semantic status pairs
  (--term-success/danger/warning/info from globals.css) are first-class
  variants so trading states (fill states, market status, KYC/Payment
  outcomes) read identically to the CRM's tone model.
*/

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-(length:--term-text-xs) font-medium whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success:
          "border-(--term-success-border) bg-(--term-success-bg) text-(--term-success-fg)",
        danger:
          "border-(--term-danger-border) bg-(--term-danger-bg) text-(--term-danger-fg)",
        warning:
          "border-(--term-warning-border) bg-(--term-warning-bg) text-(--term-warning-fg)",
        info: "border-(--term-info-border) bg-(--term-info-bg) text-(--term-info-fg)",
        up: "bg-up/10 text-up",
        down: "bg-down/10 text-down",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant ?? "default"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
