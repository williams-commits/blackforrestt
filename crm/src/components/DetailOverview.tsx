import { cn } from "@/lib/utils";

/**
 * One labeled fact in a record Overview grid — shared by all module detail
 * pages so the field typography stays identical everywhere. Falsy values
 * render as an em dash in tertiary ink.
 */
export function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "wrap-break-words text-[13px] font-medium leading-snug",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
