interface CustomFieldDefLite {
  key: string;
  label: string;
  fieldType: string;
  options: unknown;
}

/** Render a record's custom-field values against the active definitions. */
export function CustomFieldsPanel({
  defs,
  values,
}: {
  defs: CustomFieldDefLite[];
  values: unknown;
}) {
  if (defs.length === 0) return null;
  const map = (values && typeof values === "object" ? values : {}) as Record<string, unknown>;
  const rendered = defs.filter((def) => def.key in map && map[def.key] !== null && map[def.key] !== "");
  if (rendered.length === 0) return null;
  return (
    <>
      {rendered.map((def) => {
        const value = map[def.key];
        const display = Array.isArray(value)
          ? value.join(", ")
          : typeof value === "boolean"
            ? value
              ? "yes"
              : "no"
            : String(value);
        return (
          <div key={def.key}>
            <dt className="text-xs uppercase tracking-wide text-stone-400">{def.label}</dt>
            <dd className="text-sm">{display}</dd>
          </div>
        );
      })}
    </>
  );
}
