import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/Icon"

/**
 * EmptyState — icon + title + description + optional action.
 * shadcn-style primitive (was in the ui.tsx seam); the Tailwind classes
 * replace the legacy `.empty-state*` globals.css rules.
 */
function EmptyState({
  icon,
  iconTile = true,
  tone = "default",
  title,
  description,
  action,
  className,
}: {
  /** Leading lucide icon (via the Icon seam) — name from the icon map. */
  icon?: string
  /**
   * Block variant presentation: true renders the icon in a tinted tile
   * (substantial, replaces the retired 96px line-art); false renders a
   * bare muted icon. Inline layouts pass className with justify-start etc.
   */
  iconTile?: boolean
  /** error tone renders the title in destructive ink (load failures). */
  tone?: "default" | "error"
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        iconTile ? (
          <span className="mb-3 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
            <Icon name={icon} size={26} strokeWidth={1.5} />
          </span>
        ) : (
          <Icon name={icon} size={40} strokeWidth={1.5} className="mb-3 text-muted-foreground/50" />
        )
      ) : null}
      <p
        data-slot="empty-state-title"
        className={cn(
          "mb-1 text-lg font-semibold",
          tone === "error" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {title}
      </p>
      {description ? (
        <p data-slot="empty-state-description" className="mx-auto mb-4 max-w-80 text-sm leading-relaxed text-muted-foreground/80">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
