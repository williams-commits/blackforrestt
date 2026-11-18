import { cn } from "@/lib/utils";
import { createIdenticon } from "@/lib/userIdenticon";

const SIZE_CLASSES = {
  sm: "size-6 rounded-[7px]",
  md: "size-[30px] rounded-lg",
  lg: "size-[38px] rounded-[10px]",
} as const;

const PALETTE_SURFACES = [
  "bg-panel-3",
  "bg-panel-2",
  "bg-brand-soft",
  "bg-muted",
] as const;

export function UserAvatar({
  identity,
  name,
  size = "md",
  className,
}: {
  identity?: string | null;
  name?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const seed = identity?.trim() || name?.trim() || "user";
  const pattern = createIdenticon(seed);

  return (
    <span
      aria-hidden="true"
      title={name ?? undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden text-brand shadow-sm ring-1 ring-inset ring-border-soft",
        SIZE_CLASSES[size],
        PALETTE_SURFACES[pattern.palette],
        className,
      )}
    >
      <svg viewBox="0 0 8 8" className="size-full" shapeRendering="crispEdges" aria-hidden="true">
        {pattern.cells.map((cell, index) => (
          <rect
            key={`${cell.x}-${cell.y}-${index}`}
            x={cell.x + 0.06}
            y={cell.y + 0.06}
            width={0.88}
            height={0.88}
            fill="currentColor"
            opacity={cell.opacity}
          />
        ))}
      </svg>
    </span>
  );
}
