"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
}

interface JobSummary {
  id: string;
  objectType: string;
  status: string;
  strategy: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  duplicateCount: number;
  errorCount: number;
  fileKey: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface ValidationResponse {
  issues: Array<{ row: number; message: string; level: string }>;
  duplicates: Array<{ row: number; matchOn: string; existingId: string; label: string }>;
  summary: { total: number; valid: number; errorRows: number; duplicateRows: number };
}

const OBJECT_TYPES: Array<{ value: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER"; label: string }> = [
  { value: "LEAD", label: "Leads" },
  { value: "CONTACT", label: "Contacts" },
  { value: "ACCOUNT", label: "Accounts" },
  { value: "CUSTOMER", label: "Customers" },
];

/** Importable fields per object — must mirror IMPORT_FIELDS server-side. */
const FIELDS: Record<string, FieldDef[]> = {
  LEAD: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "secondaryPhone", label: "Secondary phone" },
    { key: "company", label: "Company" },
    { key: "country", label: "Country" },
    { key: "region", label: "Region" },
    { key: "source", label: "Source" },
    { key: "score", label: "Score (0-100)" },
    { key: "priority", label: "Priority" },
    { key: "externalId", label: "External ID" },
    { key: "statusName", label: "Status (by name)" },
  ],
  CONTACT: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "jobTitle", label: "Job title" },
    { key: "leadSource", label: "Lead source" },
    { key: "externalId", label: "External ID" },
    { key: "statusName", label: "Status (by name)" },
  ],
  ACCOUNT: [
    { key: "name", label: "Account name", required: true },
    { key: "industry", label: "Industry" },
    { key: "companySize", label: "Company size" },
    { key: "website", label: "Website" },
    { key: "city", label: "City" },
    { key: "country", label: "Country" },
    { key: "externalId", label: "External ID" },
  ],
  CUSTOMER: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "source", label: "Source" },
    { key: "statusName", label: "Status (by name)" },
  ],
};

const MAX_ROWS = 5000;
const IMPORT_STEPS = [
  { label: "Upload", help: "Choose destination and data source" },
  { label: "Map", help: "Connect columns to CRM fields" },
  { label: "Validate", help: "Review errors and duplicates" },
  { label: "Run", help: "Import and track progress" },
];

export function ImportWizard({ hasPermission }: { hasPermission: boolean }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [source, setSource] = useState<"csv" | "sheets">("csv");
  // Default Source applied to rows whose sheet has no source value — the
  // import equivalent of the Source field on the create form.
  const [defaultSource, setDefaultSource] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [objectType, setObjectType] = useState<"LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER">("LEAD");
  const [fileName, setFileName] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [matchRules, setMatchRules] = useState({ email: true, phone: false, externalId: true });
  const [strategy, setStrategy] = useState<"CREATE" | "UPDATE" | "UPSERT">("CREATE");
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobSummary | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [savedMappings, setSavedMappings] = useState<Array<{ id: string; name: string; objectType: string; mapping: Record<string, string> }>>([]);
  const [mappingName, setMappingName] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshJobs = useCallback(async () => {
    const response = await fetch("/api/imports");
    if (response.ok) setJobs((await response.json()).data);
  }, []);

  const refreshMappings = useCallback(async () => {
    const response = await fetch("/api/imports/mappings");
    if (response.ok) setSavedMappings((await response.json()).data);
  }, []);

  useEffect(() => {
    if (hasPermission) {
      void refreshJobs();
      void refreshMappings();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasPermission, refreshJobs, refreshMappings]);

  function handleFile(file: File) {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0 && result.data.length === 0) {
          setError("Could not parse this CSV.");
          return;
        }
        if (result.data.length > MAX_ROWS) {
          setError(`File has ${result.data.length} rows — the limit is ${MAX_ROWS}.`);
          return;
        }
        const headerColumns = result.meta.fields ?? [];
        setColumns(headerColumns);
        setRows(result.data);
        setFileName(file.name);
        // Auto-map by fuzzy column-name match.
        const fields = FIELDS[objectType] ?? [];
        const auto: Record<string, string> = {};
        for (const column of headerColumns) {
          const normalized = column.toLowerCase().replace(/[^a-z]/g, "");
          const field = fields.find((candidate) => normalized === candidate.key.toLowerCase())
            ?? fields.find((candidate) => normalized.includes(candidate.key.toLowerCase()));
          if (field && !Object.values(auto).includes(field.key)) auto[column] = field.key;
        }
        setMapping(auto);
        setStep(2);
      },
    });
  }

  async function runValidation() {
    setValidating(true);
    setError(null);
    try {
      const response = await fetch("/api/imports/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectType, mapping, matchRules, defaults: { source: defaultSource.trim() || undefined }, rows }),
      });
      const body = (await response.json().catch(() => null)) as { data?: ValidationResponse; error?: string } | null;
      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Validation failed.");
        return;
      }
      setValidation(body.data);
      setStep(3);
    } finally {
      setValidating(false);
    }
  }

  async function loadSheet() {
    setError(null);
    if (!sheetUrl.trim()) {
      setError("Paste the published sheet CSV link first.");
      return;
    }
    setValidating(true);
    try {
      const response = await fetch("/api/imports/sheets/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl.trim() }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { columns: string[]; preview: Array<Record<string, string>>; totalRows: number };
        error?: string;
      } | null;
      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Could not read the sheet.");
        return;
      }
      if (body.data.totalRows > MAX_ROWS) {
        setError(`Sheet has ${body.data.totalRows} rows — the limit is ${MAX_ROWS}.`);
        return;
      }
      setColumns(body.data.columns);
      setRows(body.data.preview.concat(await Promise.resolve(body.data.preview)).slice(0, body.data.totalRows) as never);
      // Full rows come at import time; preview carries the shape only.
      setFileName(`sheet (${body.data.totalRows} rows)`);
      setStep(2);
    } finally {
      setValidating(false);
    }
  }

  async function runImport() {
    setError(null);
    const endpoint = source === "sheets" ? "/api/imports/sheets" : "/api/imports";
    const defaults = { source: defaultSource.trim() || undefined };
    const payload =
      source === "sheets"
        ? { url: sheetUrl.trim(), objectType, strategy, mapping, matchRules, defaults }
        : { objectType, strategy, mapping, matchRules, defaults, rows, fileName };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as { data?: { jobId: string }; error?: string } | null;
    if (!response.ok || !body?.data) {
      setError(body?.error ?? "Could not start import.");
      return;
    }
    setStep(4);
    pollRef.current = setInterval(async () => {
      const statusResponse = await fetch(`/api/imports/${body.data!.jobId}`);
      if (!statusResponse.ok) return;
      const statusBody = (await statusResponse.json()) as { data: JobSummary };
      setJob(statusBody.data);
      if (statusBody.data.status !== "RUNNING" && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        void refreshJobs();
      }
    }, 700);
  }

  async function saveMapping() {
    if (!mappingName) return;
    await fetch("/api/imports/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mappingName, objectType, mapping }),
    });
    setMappingName("");
    void refreshMappings();
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setStep(1);
    setColumns([]);
    setRows([]);
    setMapping({});
    setValidation(null);
    setJob(null);
    setFileName("");
    setError(null);
  }

  if (!hasPermission) {
    return (
      <div className="space-y-6">
        <WorkspaceHeader
          eyebrow="Data operations"
          title="Import center"
          subtitle="Importing is protected because it can create or update many CRM records at once."
          metrics={[
            { label: "Permission", value: "Required", tone: "warning" },
            { label: "Access", value: "View only", tone: "info" },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="card overflow-hidden">
            <div className="border-b border-(--border-default) bg-(--bg-hover) px-6 py-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Import access</p>
              <h2 className="mt-2 text-2xl font-semibold text-(--text-primary)">Ask an admin to enable imports</h2>
              <p className="mt-2 max-w-2xl text-sm text-(--text-secondary)">
                Your current role cannot upload CSV files or Google Sheets into the CRM. This keeps leads, contacts,
                accounts, and customers safe from accidental bulk changes.
              </p>
            </div>
            <div className="grid gap-3 p-6 sm:grid-cols-3">
              {[
                ["1", "Prepare your file", "Clean the spreadsheet and keep a header row."],
                ["2", "Request permission", "Ask for the LEADS_IMPORT role permission."],
                ["3", "Import safely", "Map, validate, and review duplicates before records are written."],
              ].map(([stepNumber, title, description]) => (
                <div key={stepNumber} className="rounded-xl border border-(--border-default) bg-(--bg-surface) p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--bg-selected) text-sm font-semibold text-(--text-brand)">
                    {stepNumber}
                  </span>
                  <p className="mt-3 font-medium text-(--text-primary)">{title}</p>
                  <p className="mt-1 text-sm text-(--text-secondary)">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="card p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">What admins unlock</p>
            <ul className="mt-4 space-y-3 text-sm text-(--text-secondary)">
              <li className="rounded-lg bg-(--bg-subtle) p-3">CSV and Google Sheets import wizard</li>
              <li className="rounded-lg bg-(--bg-subtle) p-3">Column mapping and saved mappings</li>
              <li className="rounded-lg bg-(--bg-subtle) p-3">Duplicate checks before import</li>
              <li className="rounded-lg bg-(--bg-subtle) p-3">Import history, retries, and error CSV downloads</li>
            </ul>
            <Link href="/docs#imports" className="btn btn-secondary mt-5 w-full justify-center">
              Read import guide
            </Link>
          </aside>
        </div>
      </div>
    );
  }

  const fields = FIELDS[objectType] ?? [];
  const mappedFields = new Set(Object.values(mapping));
  const missingRequired = fields.filter((field) => field.required && !mappedFields.has(field.key));
  const selectedObjectLabel = OBJECT_TYPES.find((entry) => entry.value === objectType)?.label ?? objectType;
  const mappedColumnCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        eyebrow="Data operations"
        title="Import center"
        subtitle={fileName ? `${fileName} · ${IMPORT_STEPS[step - 1].help}` : "Bring clean, trusted data into your workspace with preview, mapping, duplicate checks, and safe execution."}
        actions={step > 1 ? <button type="button" onClick={reset} className="btn btn-secondary">Start over</button> : undefined}
        metrics={[
          { label: "Step", value: `${step}/4`, tone: "brand" },
          { label: "Recent jobs", value: jobs.length, tone: "info" },
          { label: "Destination", value: selectedObjectLabel, tone: "success" },
        ]}
      />
      <div className="grid gap-2 rounded-2xl border border-(--border-default) bg-(--bg-surface) p-2 md:grid-cols-4">
        {IMPORT_STEPS.map((entry, index) => {
          const stepNumber = index + 1;
          const active = step === stepNumber;
          const complete = step > stepNumber;
          return (
            <div
              key={entry.label}
              className={`rounded-xl border p-3 transition ${
                active
                  ? "border-(--brand) bg-(--bg-selected)"
                  : complete
                    ? "border-(--success) bg-(--success-bg)"
                    : "border-transparent bg-(--bg-subtle)"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  active ? "bg-(--brand) text-white" : complete ? "bg-(--success) text-white" : "bg-(--bg-surface) text-(--text-tertiary)"
                }`}>
                  {complete ? "✓" : stepNumber}
                </span>
                <p className={`text-sm font-semibold ${active ? "text-(--text-brand)" : "text-(--text-primary)"}`}>{entry.label}</p>
              </div>
              <p className="mt-2 text-xs text-(--text-secondary)">{entry.help}</p>
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card space-y-5" style={{ padding: "var(--space-6)" }}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Start import</p>
              <h2 className="mt-1 text-xl font-semibold text-(--text-primary)">Choose where this data belongs</h2>
              <p className="mt-1 text-sm text-(--text-secondary)">
                Select the CRM object first so the wizard can suggest the right fields and validation rules.
              </p>
            </div>
            <div>
              <label htmlFor="import-object" className="mb-1 block text-sm font-medium">
                Import destination
              </label>
              <select
                id="import-object"
                value={objectType}
                onChange={(event) => setObjectType(event.target.value as typeof objectType)}
                className="input"
              >
                {OBJECT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Data source</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["csv", "CSV file", "Upload a spreadsheet export from your computer."],
                  ["sheets", "Google Sheet", "Paste a published Sheet CSV link."],
                ].map(([value, title, description]) => {
                  const active = source === value;
                  return (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        active ? "border-(--brand) bg-(--bg-selected)" : "border-(--border-default) bg-(--bg-surface) hover:bg-(--bg-hover)"
                      }`}
                    >
                      <input
                        type="radio"
                        name="import-source"
                        checked={active}
                        onChange={() => setSource(value as "csv" | "sheets")}
                        className="sr-only"
                      />
                      <span className="text-sm font-semibold text-(--text-primary)">{title}</span>
                      <span className="mt-1 block text-sm text-(--text-secondary)">{description}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {source === "sheets" ? (
              <div>
                <label htmlFor="sheet-url" className="mb-1 block text-sm font-medium">
                  Published sheet CSV link
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    id="sheet-url"
                    value={sheetUrl}
                    onChange={(event) => setSheetUrl(event.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => void loadSheet()}
                    className="btn btn-primary"
                    style={{ background: "var(--brand)" }}
                  >
                    {validating ? "Loading…" : "Load sheet"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-(--text-tertiary)">In Google Sheets, publish to web as CSV first.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-(--border-strong) bg-(--bg-subtle) p-6 text-center">
                <label htmlFor="import-file" className="block cursor-pointer">
                  <span className="text-base font-semibold text-(--text-primary)">Drop in a CSV export</span>
                  <span className="mt-1 block text-sm text-(--text-secondary)">
                    Max {MAX_ROWS.toLocaleString()} rows. Header row required.
                  </span>
                  <input
                    id="import-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                    className="input mx-auto mt-4 max-w-md"
                  />
                </label>
              </div>
            )}
          </div>

          <aside className="card p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Safety checks</p>
            <div className="mt-4 space-y-3">
              {[
                ["Preview first", "You see sample rows before mapping."],
                ["Required fields", "The wizard blocks import until required fields are mapped."],
                ["Duplicate matching", "Email, phone, and external ID can protect existing records."],
                ["No silent writes", "Nothing is created until you validate and confirm."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-xl bg-(--bg-subtle) p-3">
                  <p className="text-sm font-medium text-(--text-primary)">{title}</p>
                  <p className="text-xs text-(--text-secondary)">{description}</p>
                </div>
              ))}
            </div>
            <Link href="/docs#imports" className="btn btn-secondary mt-5 w-full justify-center">
              Import guide
            </Link>
          </aside>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card overflow-hidden">
            <div className="border-b border-(--border-default) bg-(--bg-hover) px-4 py-3">
              <p className="text-sm font-semibold text-(--text-primary)">Preview</p>
              <p className="text-xs text-(--text-secondary)">First 3 rows from {fileName || "your source"}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-(--text-secondary) uppercase tracking-wide">
                    {columns.map((column) => (
                      <th key={column} className="px-2 py-1 font-medium">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((row, index) => (
                    <tr key={index} className="border-t border-(--border-default)">
                      {columns.map((column) => (
                        <td key={column} className="px-2 py-1">{row[column]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: "var(--space-4)" }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-(--text-primary)">Map columns to {objectType.toLowerCase()} fields</p>
                <p className="text-xs text-(--text-secondary)">{mappedColumnCount} of {columns.length} columns mapped</p>
              </div>
              <span className={`badge ${missingRequired.length > 0 ? "badge-warning" : "badge-success"}`}>
                {missingRequired.length > 0 ? `${missingRequired.length} required missing` : "Required fields ready"}
              </span>
            </div>
            {missingRequired.length > 0 ? (
              <p className="mb-2 rounded-md bg-(--warning-bg) px-3 py-2 text-sm text-(--warning)">
                Required fields not mapped: {missingRequired.map((field) => field.label).join(", ")}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <span className="w-40 truncate text-sm text-(--text-secondary)" title={column}>{column}</span>
                  <span aria-hidden className="text-(--text-tertiary)">→</span>
                  <select
                    aria-label={`Map ${column}`}
                    value={mapping[column] ?? ""}
                    onChange={(event) =>
                      setMapping((previous) => ({ ...previous, [column]: event.target.value }))
                    }
                    className="input flex-1" style={{ height: "32px" }}
                  >
                    <option value="">— skip —</option>
                    {fields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                        {field.required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          </div>

          <div className="card grid gap-5 sm:grid-cols-2" style={{ padding: "var(--space-4)" }}>
            {(() => {
              const sourceField = fields.find((f) => f.key === "source" || f.key === "leadSource");
              if (!sourceField) return null;
              return (
                <div className="rounded-xl bg-(--bg-subtle) p-4">
                  <p className="mb-2 text-sm font-semibold text-(--text-primary)">Default values</p>
                  <label htmlFor="default-source" className="mb-1 block text-sm text-(--text-secondary)">
                    Default {sourceField.label.toLowerCase()} for imported rows
                  </label>
                  <input
                    id="default-source"
                    value={defaultSource}
                    onChange={(event) => setDefaultSource(event.target.value)}
                    placeholder={objectType === "LEAD" ? "e.g. WEB_FORM, REFERRAL…" : "e.g. WEBSITE, PARTNER…"}
                    maxLength={60}
                    className="input"
                  />
                  <p className="mt-2 text-xs text-(--text-tertiary)">
                    Applied to every row whose sheet has no {sourceField.label.toLowerCase()} value — a mapped column always wins. Ignored when updating existing records.
                  </p>
                </div>
              );
            })()}
            <div className="rounded-xl bg-(--bg-subtle) p-4">
              <p className="mb-2 text-sm font-semibold text-(--text-primary)">Duplicate matching</p>
              {(["email", "phone", "externalId"] as const).map((rule) => (
                <label key={rule} className="mr-4 inline-flex items-center gap-2 text-sm text-(--text-secondary)">
                  <input
                    type="checkbox"
                    checked={matchRules[rule]}
                    onChange={(event) => setMatchRules((prev) => ({ ...prev, [rule]: event.target.checked }))}
                  />
                  {rule === "externalId" ? "External ID" : rule}
                </label>
              ))}
              <p className="mt-2 text-xs text-(--text-tertiary)">Matched duplicates can be skipped, updated, or upserted based on your strategy.</p>
            </div>
            <div className="rounded-xl bg-(--bg-subtle) p-4">
              <p className="mb-2 text-sm font-semibold text-(--text-primary)">Strategy</p>
              {(
                [
                  ["CREATE", "Create new (duplicates skipped)"],
                  ["UPDATE", "Update matched only"],
                  ["UPSERT", "Create or update"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="mb-2 block rounded-lg bg-(--bg-surface) p-2 text-sm text-(--text-secondary)">
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === value}
                    onChange={() => setStrategy(value)}
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ padding: "var(--space-4)" }}>
            <select
              aria-label="Saved mappings"
              defaultValue=""
              onChange={(event) => {
                const saved = savedMappings.find((entry) => entry.id === event.target.value);
                if (saved) setMapping(saved.mapping);
              }}
              className="input"
            >
              <option value="">Load saved mapping…</option>
              {savedMappings
                .filter((entry) => entry.objectType === objectType)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
            <input
              aria-label="Mapping name"
              placeholder="Name this mapping"
              value={mappingName}
              onChange={(event) => setMappingName(event.target.value)}
              className="input"
            />
            <button
              type="button"
              onClick={() => void saveMapping()}
              disabled={!mappingName}
              className="btn btn-secondary"
            >
              Save mapping
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void runValidation()}
              disabled={validating || missingRequired.length > 0}
              className="btn btn-primary"
              style={{ background: "var(--brand)" }}
            >
              {validating ? "Validating…" : "Validate rows"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && validation ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Total rows", validation.summary.total, "brand"],
              ["Ready to import", validation.summary.valid, "success"],
              ["Row errors", validation.summary.errorRows, "warning"],
              ["Duplicates", validation.summary.duplicateRows, "info"],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="card" style={{ padding: "var(--space-4)" }}>
                <p className={`text-2xl font-semibold ${tone === "success" ? "text-(--success)" : tone === "warning" ? "text-(--warning)" : tone === "info" ? "text-(--text-brand)" : "text-(--text-primary)"}`}>{value as number}</p>
                <p className="text-sm text-(--text-secondary)">{label as string}</p>
              </div>
            ))}
          </div>

          <div className="card border-(--border-default)" style={{ padding: "var(--space-5)" }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-(--text-primary)">Validation review</p>
                <p className="text-sm text-(--text-secondary)">
                  Review the summary before writing anything into {selectedObjectLabel.toLowerCase()}.
                </p>
              </div>
              <span className={`badge ${validation.summary.errorRows > 0 ? "badge-warning" : "badge-success"}`}>
                {validation.summary.errorRows > 0 ? "Needs attention" : "Ready to import"}
              </span>
            </div>
          </div>

          {validation.issues.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="border-b border-(--border-default) bg-(--warning-bg) px-4 py-3">
                <p className="text-sm font-semibold text-(--warning)">Issues</p>
                <p className="text-xs text-(--warning)">Fix these rows or they may be skipped.</p>
              </div>
              <div className="p-4">
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {validation.issues.slice(0, 100).map((issue, index) => (
                  <li key={index} className={issue.level === "error" ? "text-(--error)" : "text-(--warning)"}>
                    Row {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
              {validation.issues.length > 100 ? (
                <p className="text-xs text-(--text-tertiary)">…and {validation.issues.length - 100} more.</p>
              ) : null}
              </div>
            </div>
          ) : null}

          {validation.duplicates.length > 0 ? (
            <div className="card overflow-hidden" style={{ borderColor: "var(--warning-border)" }}>
              <div className="border-b px-4 py-3" style={{ borderColor: "var(--warning-border)", background: "var(--warning-bg)" }}>
                <p className="text-sm font-semibold text-(--warning)">Possible duplicates</p>
                <p className="text-xs text-(--warning)">Strategy: {strategy.toLowerCase()}</p>
              </div>
              <div className="p-4">
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-amber-900">
                {validation.duplicates.slice(0, 100).map((duplicate, index) => (
                  <li key={index}>
                    Row {duplicate.row}: “{duplicate.label}” (matched on {duplicate.matchOn})
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-(--warning)">
                With strategy <strong>{strategy}</strong>
                {strategy === "CREATE" ? " these rows will be skipped." : " these rows will update the matched record."}
              </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setStep(2)} className="btn btn-secondary">
              Back to mapping
            </button>
            <button
              type="button"
              onClick={() => void runImport()}
              className="btn btn-primary"
              style={{ background: "var(--brand)" }}
            >
              Import {validation.summary.valid + validation.summary.duplicateRows} row(s)
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 && job ? (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-(--border-default) bg-(--bg-hover) px-6 py-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Import run</p>
              <h2 className="mt-1 text-xl font-semibold text-(--text-primary)">
                {job.status === "RUNNING"
                  ? `Importing ${job.processedRows}/${job.totalRows} rows`
                  : job.status === "COMPLETED"
                    ? "Import completed"
                    : `Import ${job.status.toLowerCase()}`}
              </h2>
            </div>
            <div className="p-6">
            {job.status === "RUNNING" ? (
              <div className="mt-2 h-2 overflow-hidden rounded bg-(--bg-subtle)">
                <div
                  className="h-full"
                  style={{
                    width: `${job.totalRows === 0 ? 0 : Math.round((job.processedRows / job.totalRows) * 100)}%`,
                    background: "var(--brand)",
                  }}
                />
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Created", job.createdCount],
                ["Updated", job.updatedCount],
                ["Skipped", job.skippedCount],
                ["Duplicates", job.duplicateCount],
                ["Errors", job.errorCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="card" style={{ padding: "var(--space-3)", background: "var(--bg-subtle)" }}>
                  <p className="text-xl font-semibold">{value as number}</p>
                  <p className="text-xs text-(--text-secondary)">{label as string}</p>
                </div>
              ))}
            </div>
            {job.errorCount > 0 ? (
              <a
                href={`/api/imports/${job.id}/errors`}
                className="btn btn-secondary" style={{ marginTop: "var(--space-4)" }}
              >
                Download error report (CSV)
              </a>
            ) : null}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={reset} className="btn btn-secondary">
              Import another file
            </button>
          </div>
        </div>
      ) : step === 4 ? (
        <p className="p-6 text-center text-sm text-(--text-tertiary)">Starting import…</p>
      ) : null}

      <div className="card table-responsive overflow-hidden">
        <div className="border-b border-(--border-default) bg-(--bg-hover) px-4 py-3">
          <p className="text-sm font-semibold text-(--text-primary)">Recent imports</p>
          <p className="text-xs text-(--text-secondary)">Audit recent jobs, retries, and outcomes.</p>
        </div>
        {jobs.length === 0 ? (
          <p className="p-6 text-center text-sm text-(--text-tertiary)">No imports yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr className="border-b border-(--border-default) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
                <th className="px-2 py-1 font-medium">File</th>
                <th className="px-2 py-1 font-medium">Object</th>
                <th className="px-2 py-1 font-medium">Strategy</th>
                <th className="px-2 py-1 font-medium">Rows</th>
                <th className="px-2 py-1 font-medium">Created / Updated / Dup / Err</th>
                <th className="px-2 py-1 font-medium">Status</th>
                <th className="px-2 py-1 font-medium">When</th>
                <th className="px-2 py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((entry) => (
                <tr key={entry.id} className="border-b border-(--border-default)">
                  <td className="px-2 py-1">{entry.fileKey ?? "—"}</td>
                  <td className="px-2 py-1">{entry.objectType.toLowerCase()}</td>
                  <td className="px-2 py-1">{entry.strategy.toLowerCase()}</td>
                  <td className="px-2 py-1">{entry.processedRows}/{entry.totalRows}</td>
                  <td className="px-2 py-1">
                    {entry.createdCount} / {entry.updatedCount} / {entry.duplicateCount} / {entry.errorCount}
                  </td>
                  <td className="px-2 py-1">
                    <span className={`badge ${
                      entry.status === "COMPLETED"
                        ? "badge-success"
                        : entry.status === "FAILED"
                          ? "badge-error"
                          : "badge-neutral"
                    }`}>
                      {entry.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-2 py-1">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      className="text-xs text-(--brand) hover:underline"
                      onClick={async () => {
                        const response = await fetch(`/api/imports/${entry.id}/retry`, { method: "POST" });
                        if (response.ok) void refreshJobs();
                      }}
                    >
                      retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
