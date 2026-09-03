"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";

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

export function ImportWizard({ hasPermission }: { hasPermission: boolean }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
        body: JSON.stringify({ objectType, mapping, matchRules, rows }),
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

  async function runImport() {
    setError(null);
    const response = await fetch("/api/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectType, strategy, mapping, matchRules, rows, fileName }),
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
      <div className="rounded-lg border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        You do not have permission to import data (LEADS_IMPORT required).
      </div>
    );
  }

  const fields = FIELDS[objectType] ?? [];
  const mappedFields = new Set(Object.values(mapping));
  const missingRequired = fields.filter((field) => field.required && !mappedFields.has(field.key));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Import</h1>
          <p className="text-sm text-stone-500">
            Step {step} of 4 —{" "}
            {["Upload CSV", "Map columns", "Validate", "Run & results"][step - 1]}
            {fileName ? ` · ${fileName}` : ""}
          </p>
        </div>
        {step > 1 ? (
          <button type="button" onClick={reset} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50">
            Start over
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
          <div>
            <label htmlFor="import-object" className="mb-1 block text-sm font-medium">
              Import destination
            </label>
            <select
              id="import-object"
              value={objectType}
              onChange={(event) => setObjectType(event.target.value as typeof objectType)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm"
            >
              {OBJECT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="import-file" className="mb-1 block text-sm font-medium">
              CSV file (max {MAX_ROWS.toLocaleString()} rows, header row required)
            </label>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-stone-400">
            Nothing is written at upload — mapping, validation, and duplicate checks come first.
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="mb-2 text-sm font-medium">Preview (first 3 rows)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-stone-500">
                    {columns.map((column) => (
                      <th key={column} className="px-2 py-1 font-medium">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((row, index) => (
                    <tr key={index} className="border-t border-stone-100">
                      {columns.map((column) => (
                        <td key={column} className="px-2 py-1">{row[column]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="mb-2 text-sm font-medium">Map columns to {objectType.toLowerCase()} fields</p>
            {missingRequired.length > 0 ? (
              <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Required fields not mapped: {missingRequired.map((field) => field.label).join(", ")}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <span className="w-40 truncate text-sm text-stone-600" title={column}>{column}</span>
                  <span aria-hidden className="text-stone-300">→</span>
                  <select
                    aria-label={`Map ${column}`}
                    value={mapping[column] ?? ""}
                    onChange={(event) =>
                      setMapping((previous) => ({ ...previous, [column]: event.target.value }))
                    }
                    className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
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

          <div className="grid gap-4 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Duplicate matching</p>
              {(["email", "phone", "externalId"] as const).map((rule) => (
                <label key={rule} className="mr-4 text-sm">
                  <input
                    type="checkbox"
                    checked={matchRules[rule]}
                    onChange={(event) => setMatchRules((prev) => ({ ...prev, [rule]: event.target.checked }))}
                  />{" "}
                  {rule === "externalId" ? "External ID" : rule}
                </label>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Strategy</p>
              {(
                [
                  ["CREATE", "Create new (duplicates skipped)"],
                  ["UPDATE", "Update matched only"],
                  ["UPSERT", "Create or update"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="mr-4 text-sm">
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

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white p-4">
            <select
              aria-label="Saved mappings"
              defaultValue=""
              onChange={(event) => {
                const saved = savedMappings.find((entry) => entry.id === event.target.value);
                if (saved) setMapping(saved.mapping);
              }}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
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
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void saveMapping()}
              disabled={!mappingName}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
            >
              Save mapping
            </button>
          </div>

          <button
            type="button"
            onClick={() => void runValidation()}
            disabled={validating || missingRequired.length > 0}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand)" }}
          >
            {validating ? "Validating…" : "Validate"}
          </button>
        </div>
      ) : null}

      {step === 3 && validation ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Total rows", validation.summary.total],
              ["Ready to import", validation.summary.valid],
              ["Row errors", validation.summary.errorRows],
              ["Duplicates", validation.summary.duplicateRows],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-2xl font-semibold">{value as number}</p>
                <p className="text-sm text-stone-500">{label as string}</p>
              </div>
            ))}
          </div>

          {validation.issues.length > 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="mb-2 text-sm font-medium">Issues</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {validation.issues.slice(0, 100).map((issue, index) => (
                  <li key={index} className={issue.level === "error" ? "text-red-700" : "text-amber-700"}>
                    Row {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
              {validation.issues.length > 100 ? (
                <p className="text-xs text-stone-400">…and {validation.issues.length - 100} more.</p>
              ) : null}
            </div>
          ) : null}

          {validation.duplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-medium text-amber-800">Possible duplicates</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-amber-900">
                {validation.duplicates.slice(0, 100).map((duplicate, index) => (
                  <li key={index}>
                    Row {duplicate.row}: “{duplicate.label}” (matched on {duplicate.matchOn})
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700">
                With strategy <strong>{strategy}</strong>
                {strategy === "CREATE" ? " these rows will be skipped." : " these rows will update the matched record."}
              </p>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50">
              Back to mapping
            </button>
            <button
              type="button"
              onClick={() => void runImport()}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-white"
              style={{ background: "var(--brand)" }}
            >
              Import {validation.summary.valid + validation.summary.duplicateRows} row(s)
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 && job ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <p className="text-sm font-medium">
              {job.status === "RUNNING"
                ? `Importing… ${job.processedRows}/${job.totalRows} rows`
                : job.status === "COMPLETED"
                  ? "Import completed"
                  : `Import ${job.status.toLowerCase()}`}
            </p>
            {job.status === "RUNNING" ? (
              <div className="mt-2 h-2 overflow-hidden rounded bg-stone-100">
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
                <div key={String(label)} className="rounded-md border border-stone-100 bg-stone-50 p-3">
                  <p className="text-xl font-semibold">{value as number}</p>
                  <p className="text-xs text-stone-500">{label as string}</p>
                </div>
              ))}
            </div>
            {job.errorCount > 0 ? (
              <a
                href={`/api/imports/${job.id}/errors`}
                className="mt-4 inline-block rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
              >
                Download error report (CSV)
              </a>
            ) : null}
          </div>
          <button type="button" onClick={reset} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50">
            Import another file
          </button>
        </div>
      ) : step === 4 ? (
        <p className="p-6 text-center text-sm text-stone-400">Starting import…</p>
      ) : null}

      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Recent imports</p>
        {jobs.length === 0 ? (
          <p className="text-sm text-stone-400">No imports yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-2 py-1 font-medium">File</th>
                <th className="px-2 py-1 font-medium">Object</th>
                <th className="px-2 py-1 font-medium">Strategy</th>
                <th className="px-2 py-1 font-medium">Rows</th>
                <th className="px-2 py-1 font-medium">Created / Updated / Dup / Err</th>
                <th className="px-2 py-1 font-medium">Status</th>
                <th className="px-2 py-1 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((entry) => (
                <tr key={entry.id} className="border-b border-stone-100">
                  <td className="px-2 py-1">{entry.fileKey ?? "—"}</td>
                  <td className="px-2 py-1">{entry.objectType.toLowerCase()}</td>
                  <td className="px-2 py-1">{entry.strategy.toLowerCase()}</td>
                  <td className="px-2 py-1">{entry.processedRows}/{entry.totalRows}</td>
                  <td className="px-2 py-1">
                    {entry.createdCount} / {entry.updatedCount} / {entry.duplicateCount} / {entry.errorCount}
                  </td>
                  <td className="px-2 py-1">{entry.status.toLowerCase()}</td>
                  <td className="px-2 py-1">{new Date(entry.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
