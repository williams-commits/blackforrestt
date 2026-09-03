"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FieldConfig, ObjectKey } from "@/lib/recordUi";

export interface OptionSource {
  leadStatuses: Array<{ value: string; label: string }>;
  contactStatuses: Array<{ value: string; label: string }>;
  customerStatuses: Array<{ value: string; label: string }>;
  users: Array<{ value: string; label: string }>;
  accounts: Array<{ value: string; label: string }>;
  contacts: Array<{ value: string; label: string }>;
}

interface RecordFormProps {
  object: ObjectKey;
  fields: FieldConfig[];
  options: OptionSource;
  /** Existing row for edit mode; null for create. */
  initial?: Record<string, unknown> | null;
  onClose: () => void;
}

/** Coerce a row value into a form-input value (dates → datetime-local). */
function toInputValue(field: FieldConfig, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (field.type === "datetime-local" && typeof raw === "string") return raw.slice(0, 16);
  if (field.type === "date" && typeof raw === "string") return raw.slice(0, 10);
  return String(raw);
}

export function RecordForm({ object, fields, options, initial, onClose }: RecordFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(initial?.id);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial_: Record<string, string> = {};
    for (const field of fields) {
      // Status/owner selects read from the row's relation ids.
      const rawKey =
        field.name === "statusId" ? "statusId" : field.name === "accountId" ? "accountId" : field.name;
      initial_[field.name] = toInputValue(field, initial?.[rawKey]);
    }
    return initial_;
  });

  const inputClass =
    "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const value = values[field.name];
        if (value === "") {
          // Create: omit optionals entirely; required stays (browser checks).
          if (!field.required && !editing) continue;
          payload[field.name] = null;
        } else if (field.type === "number") {
          payload[field.name] = Number(value);
        } else {
          payload[field.name] = value;
        }
      }
      const response = await fetch(
        editing ? `/api/${object}/${initial!.id}` : `/api/${object}`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Save failed.");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
    >
      <form
        method="post"
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-xl"
      >
        <h2 className="text-base font-semibold">
          {editing ? `Edit ${object.replace(/s$/, "")}` : `New ${object.replace(/s$/, "")}`}
        </h2>

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
          {fields.map((field) => {
            const resolved =
              field.optionsFrom ? options[field.optionsFrom] : (field.options ?? []);
            return (
              <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                <label htmlFor={`f-${field.name}`} className="mb-1 block text-sm font-medium">
                  {field.label}
                  {field.required ? <span aria-hidden> *</span> : null}
                </label>
                {field.type === "select" ? (
                  <select
                    id={`f-${field.name}`}
                    value={values[field.name] ?? ""}
                    onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
                    className={inputClass}
                    required={field.required}
                  >
                    <option value="">— none —</option>
                    {resolved.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`f-${field.name}`}
                    type={field.type}
                    value={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
                    className={inputClass}
                    required={field.required}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand)" }}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
