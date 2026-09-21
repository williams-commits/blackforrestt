"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { Button, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useTableSession, writeTableSession } from "@/components/useTableSession";
import { Table, THead, TBody, TR, TH, TD } from "@/components/table";

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

interface JobsPageResponse {
  data: JobSummary[];
  meta: { page: number; pageSize: number; total: number };
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
  // Job-history table state (standardized list-table pattern).
  const [jobsMeta, setJobsMeta] = useState<JobsPageResponse["meta"]>({ page: 1, pageSize: 10, total: 0 });
  const [jobsSearch, setJobsSearch] = useState("");
  const [jobsDebouncedSearch, setJobsDebouncedSearch] = useState("");
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPageSize, setJobsPageSize] = useState(10);
  const [jobsHydrated, setJobsHydrated] = useState(false);
  const [savedMappings, setSavedMappings] = useState<Array<{ id: string; name: string; objectType: string; mapping: Record<string, string> }>>([]);
  const [mappingName, setMappingName] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const jobsTotalPages = Math.max(1, Math.ceil(jobsMeta.total / jobsMeta.pageSize));

  const refreshJobs = useCallback(async () => {
    const params = new URLSearchParams({ page: String(jobsPage), pageSize: String(jobsPageSize) });
    if (jobsDebouncedSearch) params.set("q", jobsDebouncedSearch);
    const response = await fetch(`/api/imports?${params.toString()}`);
    if (!response.ok) return;
    const body = (await response.json()) as JobsPageResponse;
    setJobs(body.data);
    setJobsMeta(body.meta);
  }, [jobsPage, jobsPageSize, jobsDebouncedSearch]);

  const refreshMappings = useCallback(async () => {
    const response = await fetch("/api/imports/mappings");
    if (response.ok) setSavedMappings((await response.json()).data);
  }, []);

  // ---- job-history table session (refresh-proof page/pageSize/search) ----
  // Restore once after mount, gated by a hydrated flag so the first fetch
  // already carries the saved page/search (same pattern as RecordListPage).
  const { session: jobsSession, ready: jobsSessionReady } = useTableSession("imports");
  useEffect(() => {
    if (!jobsSessionReady) return;
    if (jobsSession) {
      if (typeof jobsSession.search === "string") {
        setJobsSearch(jobsSession.search);
        setJobsDebouncedSearch(jobsSession.search);
      }
      if (jobsSession.page !== undefined) setJobsPage(jobsSession.page);
      if (jobsSession.pageSize !== undefined) setJobsPageSize(Math.min(50, jobsSession.pageSize));
    }
    setJobsHydrated(true);
  }, [jobsSessionReady, jobsSession]);

  useEffect(() => {
    if (!jobsHydrated) return;
    writeTableSession("imports", { page: jobsPage, pageSize: jobsPageSize, search: jobsSearch });
  }, [jobsHydrated, jobsPage, jobsPageSize, jobsSearch]);

  // Debounce the search box (300ms, mirrors RecordListPage) — typing a
  // query fired one API request per keystroke otherwise.
  useEffect(() => {
    const timer = setTimeout(() => setJobsDebouncedSearch(jobsSearch), 300);
    return () => clearTimeout(timer);
  }, [jobsSearch]);

  useEffect(() => {
    if (hasPermission) {
      void refreshMappings();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasPermission, refreshMappings]);

  // Job history fetch — hits the paginated endpoint when the section mounts
  // (after session restore) and whenever page/pageSize/debouncedSearch move.
  // Imports and retries re-invoke the same refreshJobs callback.
  useEffect(() => {
    if (!hasPermission || !jobsHydrated) return;
    void refreshJobs();
  }, [hasPermission, jobsHydrated, refreshJobs]);

  // A restored page can outrun the result set (jobs pruned since the last
  // visit) — clamp to the last real page instead of showing an empty one.
  useEffect(() => {
    if (!jobsHydrated) return;
    if (jobsPage > jobsTotalPages) setJobsPage(jobsTotalPages);
  }, [jobsHydrated, jobsPage, jobsTotalPages]);

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
        body: JSON.stringify({ url: sheetUrl.trim(), rows: 500 }),
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
      // Real leading rows for mapping + validation (up to 500) — the old
      // code concatenated the 5-row display preview with itself, making the
      // validation step's counts fiction. Full sheet still re-reads at import.
      setRows(body.data.preview);
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
            <div className="card-header items-start">
              <div>
                <p className="card-title">Import access</p>
                <h2 className="mt-2 text-2xl font-semibold text-(--text-primary)">Ask an admin to enable imports</h2>
                <p className="mt-2 max-w-2xl text-sm text-(--text-secondary)">
                  Your current role cannot upload CSV files or Google Sheets into the CRM. This keeps leads, contacts,
                  accounts, and customers safe from accidental bulk changes.
                </p>
              </div>
            </div>
            <div className="grid gap-5 p-6 sm:grid-cols-3">
              {[
                ["1", "Prepare your file", "Clean the spreadsheet and keep a header row."],
                ["2", "Request permission", "Ask for the LEADS_IMPORT role permission."],
                ["3", "Import safely", "Map, validate, and review duplicates before records are written."],
              ].map(([stepNumber, title, description]) => (
                <div key={stepNumber}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--accent-soft) text-sm font-semibold text-(--accent)">
                    {stepNumber}
                  </span>
                  <p className="mt-3 font-medium text-(--text-primary)">{title}</p>
                  <p className="mt-1 text-sm text-(--text-secondary)">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="card p-5">
            <p className="card-title">What admins unlock</p>
            <ul className="mt-2 divide-y divide-(--border-hairline) text-sm text-(--text-secondary)">
              <li className="py-3">CSV and Google Sheets import wizard</li>
              <li className="py-3">Column mapping and saved mappings</li>
              <li className="py-3">Duplicate checks before import</li>
              <li className="py-3">Import history, retries, and error CSV downloads</li>
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
        actions={step > 1 ? <Button variant="secondary" onClick={reset}>Start over</Button> : undefined}
        metrics={[
          { label: "Step", value: `${step}/4`, tone: "brand" },
          { label: "Recent jobs", value: jobsMeta.total, tone: "info" },
          { label: "Destination", value: selectedObjectLabel, tone: "success" },
        ]}
      />
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-4">
        {IMPORT_STEPS.map((entry, index) => {
          const stepNumber = index + 1;
          const active = step === stepNumber;
          const complete = step > stepNumber;
          return (
            <div key={entry.label} className="flex items-start gap-3">
              <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  complete
                    ? "bg-(--accent) text-(--text-inverse)"
                    : active
                      ? "border border-(--accent) bg-(--accent-soft) text-(--accent)"
                      : "border border-(--border-hairline) text-(--text-tertiary)"
                }`}
              >
                {complete ? <Icon name="check" size={13} /> : stepNumber}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-sm font-semibold ${active ? "text-(--text-primary)" : "text-(--text-secondary)"}`}>{entry.label}</p>
                <p className="mt-0.5 text-xs text-(--text-tertiary)">{entry.help}</p>
              </div>
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
          <div className="card space-y-5 p-6">
            <div>
              <p className="card-title">Start import</p>
              <h2 className="mt-1 text-xl font-semibold text-(--text-primary)">Choose where this data belongs</h2>
              <p className="mt-1 text-sm text-(--text-secondary)">
                Select the CRM object first so the wizard can suggest the right fields and validation rules.
              </p>
            </div>
            <div>
              <label htmlFor="import-object" className="input-label">
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
              <p className="input-label">Data source</p>
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
                        active ? "border-(--accent) bg-(--accent-soft)" : "border-(--border-default) bg-(--bg-surface) hover:bg-(--bg-hover)"
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
                <label htmlFor="sheet-url" className="input-label">
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
                  <Button variant="primary" loading={validating} onClick={() => void loadSheet()}>
                    Load sheet
                  </Button>
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
                    hidden
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
            <p className="card-title">Safety checks</p>
            <ul className="mt-2 divide-y divide-(--border-hairline)">
              {[
                ["Preview first", "You see sample rows before mapping."],
                ["Required fields", "The wizard blocks import until required fields are mapped."],
                ["Duplicate matching", "Email, phone, and external ID can protect existing records."],
                ["No silent writes", "Nothing is created until you validate and confirm."],
              ].map(([title, description]) => (
                <li key={title} className="py-3">
                  <p className="text-sm font-medium text-(--text-primary)">{title}</p>
                  <p className="mt-0.5 text-xs text-(--text-secondary)">{description}</p>
                </li>
              ))}
            </ul>
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
            <div className="card-header">
              <div className="min-w-0">
                <p className="card-title">Preview</p>
                <p className="mt-0.5 text-xs normal-case tracking-normal text-(--text-secondary)">First 3 rows from {fileName || "your source"}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    {columns.map((column) => (
                      <TH key={column}>{column}</TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {rows.slice(0, 3).map((row, index) => (
                    <TR key={index}>
                      {columns.map((column) => (
                        <TD key={column}>{row[column]}</TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>

          <div className="card p-4">
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
                    className="input input-sm flex-1"
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

          <div className="card grid gap-5 p-4 sm:grid-cols-2">
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

          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
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
            <Button variant="secondary" onClick={() => void saveMapping()} disabled={!mappingName}>
              Save mapping
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              loading={validating}
              disabled={missingRequired.length > 0}
              onClick={() => void runValidation()}
            >
              Validate rows
            </Button>
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
              <div key={String(label)} className="card p-4">
                <p className={`text-2xl font-semibold tabular-nums ${tone === "success" ? "text-(--success)" : tone === "warning" ? "text-(--warning)" : tone === "info" ? "text-(--text-brand)" : "text-(--text-primary)"}`}>{value as number}</p>
                <p className="text-sm text-(--text-secondary)">{label as string}</p>
              </div>
            ))}
          </div>

          <div className="card p-5">
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
            <div className="card overflow-hidden">
              <div className="border-b border-(--warning-border) bg-(--warning-bg) px-4 py-3">
                <p className="text-sm font-semibold text-(--warning)">Possible duplicates</p>
                <p className="text-xs text-(--warning)">Strategy: {strategy.toLowerCase()}</p>
              </div>
              <div className="p-4">
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-(--text-primary)">
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
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back to mapping
            </Button>
            <Button variant="primary" onClick={() => void runImport()}>
              Import {validation.summary.valid + validation.summary.duplicateRows} row(s)
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 && job ? (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="min-w-0">
                <p className="card-title">Import run</p>
                <h2 className="mt-1 text-xl font-semibold text-(--text-primary)">
                  {job.status === "RUNNING"
                    ? `Importing ${job.processedRows}/${job.totalRows} rows`
                    : job.status === "COMPLETED"
                      ? "Import completed"
                      : `Import ${job.status.toLowerCase()}`}
                </h2>
              </div>
            </div>
            <div className="p-6">
            {job.status === "RUNNING" ? (
              <div className="mt-2 h-2 overflow-hidden rounded bg-(--bg-subtle)">
                <div
                  className="h-full bg-(--accent)"
                  style={{
                    width: `${job.totalRows === 0 ? 0 : Math.round((job.processedRows / job.totalRows) * 100)}%`,
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
                <div key={String(label)} className="rounded-lg bg-(--bg-subtle) p-3">
                  <p className="text-xl font-semibold tabular-nums">{value as number}</p>
                  <p className="text-xs text-(--text-secondary)">{label as string}</p>
                </div>
              ))}
            </div>
            {job.errorCount > 0 ? (
              <a href={`/api/imports/${job.id}/errors`} className="btn btn-secondary mt-4">
                <Icon name="download" size={13} />
                Download error report (CSV)
              </a>
            ) : null}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
          </div>
        </div>
      ) : step === 4 ? (
        <p className="p-6 text-center text-sm text-(--text-tertiary)">Starting import…</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-(--border-hairline) pb-3">
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            // Enter commits the query immediately (no 300ms wait) and
            // resets to page 1; the fetch effect picks up the change.
            setJobsDebouncedSearch(jobsSearch);
            setJobsPage(1);
          }}
        >
          <input
            type="search"
            value={jobsSearch}
            onChange={(event) => {
              setJobsSearch(event.target.value);
              // New query → the old page number is meaningless; drop to
              // page 1 immediately (the fetch still waits for the debounce).
              setJobsPage(1);
            }}
            placeholder="Search imports — file, object, status…"
            aria-label="Search imports"
            className="input input-sm"
          />
        </form>
      </div>

      <div className="card table-responsive overflow-hidden">
        <div className="card-header">
          <div className="min-w-0">
            <p className="card-title">Recent imports</p>
            <p className="mt-0.5 text-xs normal-case tracking-normal text-(--text-secondary)">Audit recent jobs, retries, and outcomes.</p>
          </div>
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            title="No imports yet"
            description={jobsDebouncedSearch ? "Try a different search — file, object, or status." : undefined}
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>File</TH>
                <TH>Object</TH>
                <TH>Strategy</TH>
                <TH>Rows</TH>
                <TH>Created / Updated / Dup / Err</TH>
                <TH>Status</TH>
                <TH>When</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {jobs.map((entry) => (
                <TR key={entry.id}>
                  <TD>{entry.fileKey ?? "—"}</TD>
                  <TD>{entry.objectType.toLowerCase()}</TD>
                  <TD>{entry.strategy.toLowerCase()}</TD>
                  <TD className="tabular-nums">{entry.processedRows}/{entry.totalRows}</TD>
                  <TD className="tabular-nums">
                    {entry.createdCount} / {entry.updatedCount} / {entry.duplicateCount} / {entry.errorCount}
                  </TD>
                  <TD>
                    <span className={`badge ${
                      entry.status === "COMPLETED"
                        ? "badge-success"
                        : entry.status === "FAILED"
                          ? "badge-error"
                          : "badge-neutral"
                    }`}>
                      {entry.status.toLowerCase()}
                    </span>
                  </TD>
                  <TD>{new Date(entry.createdAt).toLocaleString()}</TD>
                  <TD>
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
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-(--text-tertiary)">
        <span>
          {jobsMeta.total > 0 ? (
            <>
              Showing{" "}
              <strong className="text-(--text-primary)">
                {(jobsMeta.page - 1) * jobsMeta.pageSize + 1}–{Math.min(jobsMeta.page * jobsMeta.pageSize, jobsMeta.total)}
              </strong>{" "}
              of {jobsMeta.total}
              <span className="ml-2">
                · Page <strong className="text-(--text-primary)">{jobsMeta.page}</strong> of {jobsTotalPages}
              </span>
            </>
          ) : (
            <>
              Page <strong className="text-(--text-primary)">{jobsMeta.page}</strong> of {jobsTotalPages}
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Rows
            <select
              aria-label="Rows per page"
              value={jobsPageSize}
              onChange={(event) => {
                setJobsPageSize(Number(event.target.value));
                setJobsPage(1);
              }}
              className="input input-sm"
              style={{ width: "auto", display: "inline-block" }}
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={jobsPage <= 1}
            onClick={() => setJobsPage((page) => Math.max(1, page - 1))}
          >
            ← Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={jobsPage >= jobsTotalPages}
            onClick={() => setJobsPage((page) => page + 1)}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
