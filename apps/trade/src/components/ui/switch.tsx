"use client";

import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Switch — the repo's shadcn/Radix boolean toggle on the trade token bridge:
 * filled track (panel-3 → brand when on), canvas thumb, focus ring. Used for
 * every boolean switcher (theme row, preferences) so the pattern is uniform.
 */
export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors duration-150 outline-none",
        "bg-panel-3 data-[state=checked]:bg-brand",
        "focus-visible:ring-3 focus-visible:ring-ring/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-canvas shadow-sm transition-transform duration-150",
          "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
