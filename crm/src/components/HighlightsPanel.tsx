/**
 * Highlights panel — the Salesforce-signature colored strip at the top of
 * every record page showing the 4–6 most important fields at a glance.
 */
export function HighlightsPanel({
  title,
  badge,
  fields,
  children,
}: {
  title: string;
  badge?: { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" | "brand" };
  fields: Array<{ label: string; value: React.ReactNode }>;
  children?: React.ReactNode;
}) {
  return (
    <div className="highlights no-print">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="highlights-title truncate">{title}</h1>
            {badge ? (
              <span
                className="status-pill"
                style={{
                  background:
                    badge.variant === "success" ? "rgba(255,255,255,0.2)" :
                    badge.variant === "warning" ? "rgba(255,255,255,0.15)" :
                    "rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: "11px",
                }}
              >
                {badge.label}
              </span>
            ) : null}
          </div>
          {fields.length > 0 ? (
            <div
              className="mt-3 grid gap-x-6 gap-y-2"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))` }}
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
        {children ? <div className="flex shrink-0 items-start gap-2">{children}</div> : null}
      </div>
    </div>
  );
}
