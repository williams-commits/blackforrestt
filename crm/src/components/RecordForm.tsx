"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Drawer } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormError, IconInput, IconSelectTrigger } from "@/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { FieldConfig, ObjectKey, RecordObjectKey } from "@/lib/recordUi";

export interface OptionSource {
  leadStatuses: Array<{ value: string; label: string }>;
  accountStatuses: Array<{ value: string; label: string }>;
  potentialStatuses: Array<{ value: string; label: string }>;
  contactStatuses: Array<{ value: string; label: string }>;
  customerStatuses: Array<{ value: string; label: string }>;
  users: Array<{ value: string; label: string }>;
  accounts: Array<{ value: string; label: string }>;
  contacts: Array<{ value: string; label: string }>;
  campaigns: Array<{ value: string; label: string }>;
}

interface RecordFormProps {
  object: ObjectKey;
  fields: FieldConfig[];
  options: OptionSource;
  /** Existing row for edit mode; null for create. */
  initial?: Record<string, unknown> | null;
  onClose: () => void;
  /**
   * Called after a successful save. router.refresh() alone only re-renders
   * server components — client-side data holders (e.g. RecordListPage's
   * rows) need this hook to refetch.
   */
  onSaved?: () => void;
  /** Create-time duplicate detection (leads): a 409 shows matches and a
   *  "create anyway" path that re-submits with allowDuplicates. */
  duplicateCheck?: boolean;
  /** Core fields are read-only in edit mode when only action permissions are enabled. */
  canEdit?: boolean;
}

/** UTC instant → local datetime-local value (YYYY-MM-DDTHH:mm). */
function toLocalInputValue(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Coerce a row value into a form-input value (dates → datetime-local). */
function toInputValue(field: FieldConfig, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  // Server components hand Date instances through the RSC payload —
  // normalize to ISO first so String(raw) never mangles them.
  if (raw instanceof Date) raw = raw.toISOString();
  // UTC ISO → LOCAL wall time: a raw slice(0,16) hands a UTC timestamp to a
  // local-time input, silently shifting the value on every edit-save cycle.
  if (field.type === "datetime-local" && typeof raw === "string") return toLocalInputValue(raw);
  if (field.type === "date" && typeof raw === "string") return raw.slice(0, 10);
  return String(raw);
}

export interface DuplicateHit {
  objectType: string;
  id: string;
  label: string;
  email: string | null;
  matchOn: string[];
}

interface CustomFieldDefLite {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  options: string[] | null;
}

/**
 * Presentation hints for the config-driven fields: every text control shows
 * an EXAMPLE value (never a label echo) and recognized fields carry a
 * leading icon. Config-declared placeholders (recordUi) take precedence.
 */
const PLACEHOLDER_BY_FIELD: Record<string, string> = {
  firstName: "e.g. Ada",
  lastName: "e.g. Lovelace",
  email: "e.g. ada@company.com",
  phone: "e.g. +49 30 555 0134",
  company: "e.g. Acme Trading Ltd",
  country: "e.g. Germany",
  source: "e.g. WEB_FORM",
  leadSource: "e.g. Referral",
  jobTitle: "e.g. Head of Procurement",
  industry: "e.g. Logistics",
  addressLine: "e.g. Hauptstraße 12",
  city: "e.g. Berlin",
  externalId: "e.g. ERP-0042",
  score: "e.g. 75",
  revenue: "e.g. 2500000",
  title: "e.g. Send renewal proposal",
  description: "e.g. Context, next steps, and open questions…",
};
/** Same field name, different meaning per object. */
const PLACEHOLDER_BY_OBJECT_FIELD: Record<string, Record<string, string>> = {
  campaigns: { name: "e.g. Spring renewal push" },
};
/** Leading recognition icons for unambiguous field names. */
const ICON_BY_FIELD: Record<string, string> = {
  email: "mail",
  phone: "phone",
  mobile: "phone",
  fax: "phone",
  firstName: "users",
  lastName: "users",
  company: "building",
  jobTitle: "tag",
  title: "tag",
  website: "external",
  addressLine: "map_pin",
  city: "map_pin",
  country: "map_pin",
  source: "megaphone",
  leadSource: "megaphone",
  industry: "building",
  companySize: "users",
  score: "chart",
  revenue: "chart",
  externalId: "tag",
  nextFollowUpAt: "calendar",
  dueAt: "calendar",
  reminderAt: "calendar",
  startsAt: "calendar",
  endsAt: "calendar",
};
const ICON_BY_OBJECT_FIELD: Record<string, Record<string, string>> = {
  accounts: { name: "building" },
  campaigns: { name: "megaphone" },
};
/** Leading recognition icons for select fields; unrecognized pickers fall back to "list". */
const SELECT_ICON_BY_FIELD: Record<string, string> = {
  statusId: "tag",
  potentialStatusId: "tag",
  priority: "sliders",
  assignedUserId: "users",
  assignedTeamId: "users",
  ownerUserId: "users",
  teamId: "users",
  accountId: "building",
  contactId: "users",
  campaignId: "megaphone",
};
/** One-line hints — only where the format or consequence is non-obvious. */
const HELP_BY_FIELD: Record<string, string> = {
  revenue: "Minor units — 2500000 displays as 25,000.00.",
};
/** Example placeholders for admin-defined custom fields, by field type. */
const CUSTOM_PLACEHOLDER_BY_TYPE: Record<string, string> = {
  TEXT: "e.g. text value",
  NUMBER: "e.g. 100",
  CURRENCY: "e.g. 1999",
  EMAIL: "e.g. name@company.com",
  URL: "https://example.com",
};

export function RecordForm({ object, fields, options, initial, onClose, onSaved, duplicateCheck, canEdit = true }: RecordFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupMatches, setDupMatches] = useState<DuplicateHit[] | null>(null);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [customDefs, setCustomDefs] = useState<CustomFieldDefLite[]>([]);
  const [capabilities, setCapabilities] = useState({ classify: false, potentialClassify: false, assign: false });
  const [customValues, setCustomValues] = useState<Record<string, string | boolean | string[]>>(() => {
    const initialValues = initial?.customFields as Record<string, unknown> | null | undefined;
    const result: Record<string, string | boolean | string[]> = {};
    if (initialValues && typeof initialValues === "object") {
      for (const [key, value] of Object.entries(initialValues)) {
        if (Array.isArray(value)) result[key] = value.map(String);
        else result[key] = typeof value === "boolean" ? value : value === null || value === undefined ? "" : String(value);
      }
    }
    return result;
  });

  // Admin-defined custom fields for this object drive extra form inputs.
  const objectSubject: Record<RecordObjectKey, string> = {
    leads: "LEAD",
    contacts: "CONTACT",
    accounts: "ACCOUNT",
    customers: "CUSTOMER",
  };
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/custom-fields?activeOnly=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.data) return;
        setCustomDefs(
          (body.data as Array<CustomFieldDefLite & { objectType: string }>)
            .filter((def) => def.objectType === objectSubject[object as RecordObjectKey])
            .map((def) => ({ ...def, options: Array.isArray(def.options) ? (def.options as string[]) : null })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object]);
  useEffect(() => {
    void fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const permissions = body?.data?.permissions ?? [];
        const objectPrefix = object.toUpperCase();
        setCapabilities({
          // Exact, independent gates: the STATUS select needs CHANGE_STATUS,
          // the POTENTIAL select needs CHANGE_POTENTIAL_STATUS. The previous
          // OR-combination showed the status field to potential-status-only
          // users, offering a change the server then rejected with 403.
          classify: permissions.includes(`${objectPrefix}_CHANGE_STATUS`),
          potentialClassify: object === "leads" && permissions.includes("LEADS_CHANGE_POTENTIAL_STATUS"),
          assign: permissions.includes(`${objectPrefix}_ASSIGN`),
        });
      })
      .catch(() => setCapabilities({ classify: false, potentialClassify: false, assign: false }));
  }, [object]);
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
  const visibleFields = fields.filter((field) => {
    if (editing && !canEdit && !["statusId", "potentialStatusId", "assignedUserId", "assignedTeamId", "ownerUserId", "teamId"].includes(field.name)) return false;
    if (field.name === "statusId") return capabilities.classify;
    if (field.name === "potentialStatusId") return capabilities.potentialClassify;
    if (["assignedUserId", "assignedTeamId", "ownerUserId", "teamId"].includes(field.name)) return capabilities.assign;
    return true;
  });

  async function submitPayload(payload: Record<string, unknown>): Promise<boolean> {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(
        editing ? `/api/${object}/${initial!.id}` : `/api/${object}`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          details?: { matches?: { leads?: DuplicateHit[]; contacts?: DuplicateHit[]; customers?: DuplicateHit[] } };
        } | null;
        const matches = body?.details?.matches;
        const flat = [
          ...(matches?.leads ?? []),
          ...(matches?.contacts ?? []),
          ...(matches?.customers ?? []),
        ];
        if (response.status === 409 && flat.length > 0 && duplicateCheck && !editing) {
          setDupMatches(flat);
          setLastPayload(payload);
          return false;
        }
        setError(body?.error ?? "Save failed.");
        return false;
      }
      router.refresh();
      onSaved?.();
      onClose();
      return true;
    } catch {
      setError("Network error — try again.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const field of visibleFields) {
      const value = values[field.name];
      if (value === "") {
        // Create: omit optionals entirely; required stays (browser checks).
        // Edit: numerics are omitted too — the API coerces null against
        // z.coerce.number() and 400s the whole save, so a cleared Score
        // could never be saved. Nullable string fields still send null.
        if (!field.required && (!editing || field.type === "number")) continue;
        payload[field.name] = null;
      } else if (field.type === "number") {
        payload[field.name] = Number(value);
      } else {
        payload[field.name] = value;
      }
    }
    if (customDefs.length > 0) {
      const customPayload: Record<string, unknown> = {};
      for (const def of customDefs) {
        const value = customValues[def.key];
        if (Array.isArray(value)) customPayload[def.key] = value;
        else if (def.fieldType === "BOOLEAN") customPayload[def.key] = value === true;
        else if (value !== undefined && value !== "") customPayload[def.key] = value;
        else if (editing) customPayload[def.key] = null;
        else if (def.required) customPayload[def.key] = "";
      }
      payload.customFields = customPayload;
    }
    setDupMatches(null);
    await submitPayload(payload);
  }

  async function createAnyway() {
    if (!lastPayload) return;
    setDupMatches(null);
    await submitPayload({ ...lastPayload, allowDuplicates: true });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={editing ? `Edit ${object.replace(/s$/, "")}` : `New ${object.replace(/s$/, "")}`}
      subtitle={editing ? "Update record — required fields are marked with an asterisk." : "Create record — required fields are marked with an asterisk."}
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="record-form" icon="check" loading={submitting}>Save</Button>
        </>
      }
    >
      <form
        id="record-form"
        method="post"
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <FormError message={error} />

        {dupMatches ? (
          <div className="rounded-md border border-(--warning-border) bg-(--warning-bg) p-3 text-sm text-(--warning)">
            <p className="font-medium text-(--warning)">
              Possible duplicates found ({dupMatches.length})
            </p>
            <ul className="mt-2 space-y-1">
              {dupMatches.map((match) => (
                <li key={`${match.objectType}-${match.id}`} className="flex items-center justify-between gap-2">
                  <a
                    href={`/${match.objectType.toLowerCase()}s/${match.id}`}
                    className="font-medium text-(--text-primary) underline decoration-(--warning)"
                  >
                    {match.label}
                  </a>
                  <span className="text-xs text-(--warning)">
                    {match.objectType.toLowerCase()} · matches on {match.matchOn.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                icon="check"
                onClick={() => void createAnyway()}
                loading={submitting}
                className="bg-(--warning) text-(--text-inverse) hover:bg-(--warning)/80"
              >
                Create anyway
              </Button>
              <span className="text-xs text-(--warning)">or cancel and link the existing record instead.</span>
            </div>
          </div>
        ) : null}

        <div>
          <div className="form-section grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><p className="form-section-title">Record details</p><p className="form-section-help">Keep the essentials easy to find and update.</p></div>
          {visibleFields.map((field) => {
            const resolved =
              field.optionsFrom ? options[field.optionsFrom] : (field.options ?? []);
            const placeholder =
              field.placeholder ??
              PLACEHOLDER_BY_OBJECT_FIELD[object]?.[field.name] ??
              PLACEHOLDER_BY_FIELD[field.name];
            const icon =
              ICON_BY_OBJECT_FIELD[object]?.[field.name] ?? ICON_BY_FIELD[field.name];
            return (
              <Field
                key={field.name}
                id={`f-${field.name}`}
                label={field.label}
                required={field.required}
                help={HELP_BY_FIELD[field.name]}
                className={field.type === "textarea" ? "sm:col-span-2" : undefined}
              >
                {field.type === "select" ? (
                  <Select
                    required={field.required}
                    value={values[field.name] ? values[field.name] : "__none__"}
                    onValueChange={(value) =>
                      setValues((v) => ({ ...v, [field.name]: value === "__none__" ? "" : value }))
                    }
                  >
                    <IconSelectTrigger id={`f-${field.name}`} icon={SELECT_ICON_BY_FIELD[field.name] ?? "list"}>
                      <SelectValue />
                    </IconSelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="__none__">— none —</SelectItem>
                      {resolved.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea
                    id={`f-${field.name}`}
                    value={values[field.name] ?? ""}
                    placeholder={placeholder}
                    onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
                    required={field.required}
                    rows={3}
                    className="resize-y"
                  />
                ) : icon ? (
                  <IconInput
                    id={`f-${field.name}`}
                    icon={icon}
                    type={field.type}
                    value={values[field.name] ?? ""}
                    placeholder={placeholder}
                    onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
                    required={field.required}
                  />
                ) : (
                  <Input
                    id={`f-${field.name}`}
                    type={field.type}
                    value={values[field.name] ?? ""}
                    placeholder={placeholder}
                    onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
                    required={field.required}
                  />
                )}
              </Field>
            );
          })}
          </div>
          {customDefs.length > 0
            ? <div className="form-section grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><p className="form-section-title">Additional details</p><p className="form-section-help">Custom fields configured for this record type.</p></div>{customDefs.map((def) => {
                const inputType =
                  def.fieldType === "NUMBER" || def.fieldType === "CURRENCY"
                    ? "number"
                    : def.fieldType === "DATE"
                      ? "date"
                      : def.fieldType === "DATETIME"
                        ? "datetime-local"
                        : def.fieldType === "EMAIL"
                          ? "email"
                          : def.fieldType === "URL"
                            ? "url"
                            : "text";
                const customIcon =
                  def.fieldType === "EMAIL"
                    ? "mail"
                    : def.fieldType === "PHONE"
                      ? "phone"
                      : def.fieldType === "URL"
                      ? "external"
                      : def.fieldType === "NUMBER" || def.fieldType === "CURRENCY"
                        ? "chart"
                        : def.fieldType === "DATE" || def.fieldType === "DATETIME"
                          ? "calendar"
                          : def.fieldType === "TEXT"
                            ? "note"
                            : undefined;
                return (
                  <div key={`cf-${def.key}`}>
                    <label htmlFor={`cf-${def.key}`} className="form-label">
                      {def.label}
                      {def.required ? <span aria-hidden> *</span> : null}
                      <span className="ml-1 text-[10px] font-normal text-(--text-tertiary)">custom</span>
                    </label>
                    {def.fieldType === "BOOLEAN" ? (
                      <Checkbox
                        id={`cf-${def.key}`}
                        checked={customValues[def.key] === true}
                        onCheckedChange={(checked) =>
                          setCustomValues((v) => ({ ...v, [def.key]: checked === true }))
                        }
                        className="mt-2"
                      />
                    ) : def.fieldType === "SELECT" ? (
                      <Select
                        value={typeof customValues[def.key] === "string" ? (customValues[def.key] as string) : "__none__"}
                        onValueChange={(value) =>
                          setCustomValues((v) => ({ ...v, [def.key]: value === "__none__" ? "" : value }))
                        }
                      >
                        <IconSelectTrigger id={`cf-${def.key}`} icon="list">
                          <SelectValue />
                        </IconSelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="__none__">— none —</SelectItem>
                          {(def.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : def.fieldType === "MULTI_SELECT" ? (
                      // Native <select multiple> — Radix Select has no
                      // multi-select mode; styled to match the shadcn input.
                      <select
                        id={`cf-${def.key}`}
                        multiple
                        value={Array.isArray(customValues[def.key]) ? (customValues[def.key] as string[]) : []}
                        onChange={(event) =>
                          setCustomValues((v) => ({
                            ...v,
                            [def.key]: Array.from(event.target.selectedOptions).map((option) => option.value),
                          }))
                        }
                        className="h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"
                      >
                        {(def.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : customIcon ? (
                      <IconInput
                        id={`cf-${def.key}`}
                        icon={customIcon}
                        type={inputType}
                        value={typeof customValues[def.key] === "string" ? (customValues[def.key] as string) : ""}
                        placeholder={CUSTOM_PLACEHOLDER_BY_TYPE[def.fieldType]}
                        onChange={(event) =>
                          setCustomValues((v) => ({ ...v, [def.key]: event.target.value }))
                        }
                      />
                    ) : (
                      <Input
                        id={`cf-${def.key}`}
                        type={inputType}
                        value={typeof customValues[def.key] === "string" ? (customValues[def.key] as string) : ""}
                        placeholder={CUSTOM_PLACEHOLDER_BY_TYPE[def.fieldType]}
                        onChange={(event) =>
                          setCustomValues((v) => ({ ...v, [def.key]: event.target.value }))
                        }
                      />
                    )}
                  </div>
                );
              })}</div>
            : null}
        </div>

      </form>
    </Drawer>
  );
}
