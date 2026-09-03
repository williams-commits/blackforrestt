import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { normalizeEmail, normalizePhone, normalizeText } from "@/server/normalize";
import { notify } from "@/server/notifications";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
import type { ScopedContext } from "@/server/records/leads";

/**
 * CSV import engine. The wizard runs client-side (parse/preview/map); the
 * SERVER owns validation, duplicate detection, and the actual writes —
 * never trust client-side checks. Runs are job-based: POST returns
 * immediately with a jobId, processing continues in the background updating
 * progress, and the client polls. (Single-process detached promise for v1;
 * the design doc defers a dedicated worker.)
 *
 * Import gate is LEADS_IMPORT for every object type (the org's "may
 * bulk-load data" permission); created rows are owned by the importer, and
 * duplicate/update matching only ever sees records inside the importer's
 * data scope.
 */

export const MAX_ROWS = 5000;
const CHUNK = 100;

export const ImportObjectTypes = ["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER"] as const;
export type ImportObjectTypeValue = (typeof ImportObjectTypes)[number];

export interface ImportFieldDef {
  key: string;
  label: string;
  required?: boolean;
  kind: "text" | "email" | "phone" | "number" | "enum";
  statusFor?: "LEAD" | "CONTACT" | "CUSTOMER";
  enumValues?: string[];
}

export const IMPORT_FIELDS: Record<ImportObjectTypeValue, ImportFieldDef[]> = {
  LEAD: [
    { key: "firstName", label: "First name", required: true, kind: "text" },
    { key: "lastName", label: "Last name", required: true, kind: "text" },
    { key: "email", label: "Email", kind: "email" },
    { key: "phone", label: "Phone", kind: "phone" },
    { key: "secondaryPhone", label: "Secondary phone", kind: "phone" },
    { key: "company", label: "Company", kind: "text" },
    { key: "country", label: "Country", kind: "text" },
    { key: "region", label: "Region", kind: "text" },
    { key: "source", label: "Source", kind: "text" },
    { key: "score", label: "Score (0-100)", kind: "number" },
    { key: "priority", label: "Priority", kind: "enum", enumValues: ["LOW", "NORMAL", "HIGH", "URGENT"] },
    { key: "externalId", label: "External ID", kind: "text" },
    { key: "statusName", label: "Status (by name)", kind: "text", statusFor: "LEAD" },
  ],
  CONTACT: [
    { key: "firstName", label: "First name", required: true, kind: "text" },
    { key: "lastName", label: "Last name", required: true, kind: "text" },
    { key: "email", label: "Email", kind: "email" },
    { key: "phone", label: "Phone", kind: "phone" },
    { key: "jobTitle", label: "Job title", kind: "text" },
    { key: "leadSource", label: "Lead source", kind: "text" },
    { key: "externalId", label: "External ID", kind: "text" },
    { key: "statusName", label: "Status (by name)", kind: "text", statusFor: "CONTACT" },
  ],
  ACCOUNT: [
    { key: "name", label: "Account name", required: true, kind: "text" },
    { key: "industry", label: "Industry", kind: "text" },
    { key: "companySize", label: "Company size", kind: "text" },
    { key: "website", label: "Website", kind: "text" },
    { key: "city", label: "City", kind: "text" },
    { key: "country", label: "Country", kind: "text" },
    { key: "externalId", label: "External ID", kind: "text" },
  ],
  CUSTOMER: [
    { key: "firstName", label: "First name", required: true, kind: "text" },
    { key: "lastName", label: "Last name", required: true, kind: "text" },
    { key: "email", label: "Email", kind: "email" },
    { key: "phone", label: "Phone", kind: "phone" },
    { key: "source", label: "Source", kind: "text" },
    { key: "statusName", label: "Status (by name)", kind: "text", statusFor: "CUSTOMER" },
  ],
};

export const MatchRules = z.object({
  email: z.boolean().default(true),
  phone: z.boolean().default(false),
  externalId: z.boolean().default(true),
});

export const ValidateInput = z.object({
  objectType: z.enum(ImportObjectTypes),
  mapping: z.record(z.string()),
  matchRules: MatchRules,
  rows: z.array(z.record(z.string())).min(1).max(MAX_ROWS),
});

export const StartImportInput = ValidateInput.extend({
  strategy: z.enum(["CREATE", "UPDATE", "UPSERT"]).default("CREATE"),
  fileName: z.string().trim().max(200).optional(),
});

export interface RowIssue {
  row: number;
  message: string;
  level: "error" | "warning";
}

export interface RowDuplicate {
  row: number;
  matchOn: string;
  existingId: string;
  label: string;
}

export interface TransformedRow {
  data: Record<string, unknown>;
  label: string;
}

/** Normalize a mapped cell per field kind. */
function cellValue(def: ImportFieldDef, raw: string | undefined): string | number | null | "invalid" {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  switch (def.kind) {
    case "email": {
      const normalized = normalizeEmail(trimmed);
      // Import-level strictness: the format matters here even though
      // interactive forms can tolerate odd-but-real addresses.
      return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : "invalid";
    }
    case "phone": {
      const normalized = normalizePhone(trimmed);
      if (!normalized) return "invalid";
      const cleaned = normalized.replace(/^00/, "+").replace(/[\s()\-.]/g, "");
      return /^\+?\d{6,20}$/.test(cleaned) ? normalized : "invalid";
    }
    case "number": {
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? "invalid" : parsed;
    }
    case "enum":
      return def.enumValues?.includes(trimmed.toUpperCase()) ? trimmed.toUpperCase() : "invalid";
    default:
      return normalizeText(trimmed);
  }
}

interface ExistingRecord {
  id: string;
  label: string;
}

/** Scope-filtered existence lookup for duplicate/update matching. */
async function findExisting(
  objectType: ImportObjectTypeValue,
  ctx: ScopedContext,
  field: string,
  value: string,
): Promise<ExistingRecord | null> {
  const scope =
    objectType === "LEAD"
      ? assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds)
      : ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
  const condition = field === "email" ? { email: { equals: value, mode: "insensitive" as const } } : { [field]: value };
  if (objectType === "LEAD") {
    const found = await prisma.lead.findFirst({
      where: { deletedAt: null, ...scope, ...condition },
      select: { id: true, firstName: true, lastName: true },
    });
    return found ? { id: found.id, label: `${found.firstName} ${found.lastName}` } : null;
  }
  if (objectType === "CONTACT") {
    const found = await prisma.contact.findFirst({
      where: { deletedAt: null, ...scope, ...condition },
      select: { id: true, firstName: true, lastName: true },
    });
    return found ? { id: found.id, label: `${found.firstName} ${found.lastName}` } : null;
  }
  if (objectType === "ACCOUNT") {
    const found = await prisma.account.findFirst({
      where: { deletedAt: null, ...scope, ...condition },
      select: { id: true, name: true },
    });
    return found ? { id: found.id, label: found.name } : null;
  }
  const found = await prisma.customer.findFirst({
    where: { deletedAt: null, ...scope, ...condition },
    select: { id: true, firstName: true, lastName: true },
  });
  return found ? { id: found.id, label: `${found.firstName} ${found.lastName}` } : null;
}

/**
 * Validate + transform rows against field definitions. Returns per-row
 * issues, scope-filtered duplicate matches, and the transformed data for
 * rows that passed. Deterministic — used by both the validate endpoint and
 * the runner.
 */
export async function validateImport(
  ctx: ScopedContext,
  input: z.infer<typeof ValidateInput>,
): Promise<{
  issues: RowIssue[];
  duplicates: RowDuplicate[];
  transformed: Array<TransformedRow | null>;
  summary: { total: number; valid: number; errorRows: number; duplicateRows: number };
}> {
  const defs = IMPORT_FIELDS[input.objectType];
  const issues: RowIssue[] = [];
  const duplicates: RowDuplicate[] = [];
  const transformed: Array<TransformedRow | null> = [];
  const duplicateRows = new Set<number>();

  if (input.matchRules.email && !Object.values(input.mapping).includes("email")) {
    issues.push({ row: 0, message: "Email matching enabled but no column is mapped to Email.", level: "error" });
  }
  if (input.matchRules.externalId && !Object.values(input.mapping).includes("externalId")) {
    issues.push({ row: 0, message: "External-ID matching enabled but no column is mapped to External ID.", level: "error" });
  }

  const statuses = await prisma.recordStatus.findMany({
    where: { appliesTo: { in: [...new Set(defs.filter((d) => d.statusFor).map((d) => d.statusFor!))] } },
    select: { id: true, name: true, appliesTo: true },
  });
  const statusByName = new Map(
    statuses.map((status) => [`${status.appliesTo}:${status.name.toLowerCase()}`, status.id]),
  );

  input.rows.forEach((row, index) => {
    const rowNumber = index + 2; // spreadsheet row: +1 header, +1 one-based
    const data: Record<string, unknown> = {};
    let label = "";
    let rowOk = true;

    for (const def of defs) {
      const csvColumn = Object.entries(input.mapping).find(([, key]) => key === def.key)?.[0];
      const raw = csvColumn ? row[csvColumn] : undefined;
      const value = cellValue(def, raw);
      if (value === null) {
        if (def.required) {
          issues.push({ row: rowNumber, message: `Missing required field ${def.label}.`, level: "error" });
          rowOk = false;
        }
        continue;
      }
      if (value === "invalid") {
        issues.push({
          row: rowNumber,
          message: def.enumValues
            ? `${def.label}: “${raw}” must be one of ${def.enumValues.join(", ")}.`
            : `${def.label}: “${raw}” is not a valid ${def.kind}.`,
          level: "error",
        });
        rowOk = false;
        continue;
      }
      if (def.statusFor) {
        const statusId = statusByName.get(`${def.statusFor}:${String(value).toLowerCase()}`);
        if (!statusId) {
          issues.push({ row: rowNumber, message: `Unknown status “${value}”.`, level: "error" });
          rowOk = false;
          continue;
        }
        data.statusId = statusId;
        continue;
      }
      data[def.key] = value;
      if (def.key === "firstName" || def.key === "lastName" || def.key === "name") {
        label = label ? `${label} ${value}` : String(value);
      }
    }

    transformed.push(rowOk ? { data, label: label || `Row ${rowNumber}` } : null);
  });

  const emailKey = Object.entries(input.mapping).find(([, key]) => key === "email")?.[0];
  const phoneKey = Object.entries(input.mapping).find(([, key]) => key === "phone")?.[0];
  const externalKey = Object.entries(input.mapping).find(([, key]) => key === "externalId")?.[0];

  for (let index = 0; index < input.rows.length; index += 1) {
    if (!transformed[index]) continue;
    const row = input.rows[index];
    const rowNumber = index + 2;
    const checks: Array<[string, string | undefined]> = [
      ...(input.matchRules.email && emailKey ? [["email", row[emailKey]] as [string, string | undefined]] : []),
      ...(input.matchRules.phone && phoneKey ? [["phone", row[phoneKey]] as [string, string | undefined]] : []),
      ...(input.matchRules.externalId && externalKey ? [["externalId", row[externalKey]] as [string, string | undefined]] : []),
    ];
    for (const [field, rawValue] of checks) {
      const value =
        field === "email"
          ? (normalizeEmail(rawValue) ?? "")
          : field === "phone"
            ? (normalizePhone(rawValue) ?? "")
            : (rawValue?.trim() ?? "");
      if (!value) continue;
      const existing = await findExisting(input.objectType, ctx, field, value);
      if (existing) {
        duplicates.push({ row: rowNumber, matchOn: field, existingId: existing.id, label: existing.label });
        duplicateRows.add(rowNumber);
        break; // one reported match per row
      }
    }
  }

  const errorRows = issues.filter((issue) => issue.level === "error" && issue.row > 0).length;
  return {
    issues,
    duplicates,
    transformed,
    summary: {
      total: input.rows.length,
      valid: input.rows.length - errorRows - duplicateRows.size,
      errorRows,
      duplicateRows: duplicateRows.size,
    },
  };
}

/** Ownership defaults for imported rows. */
function ownership(objectType: ImportObjectTypeValue, ctx: ScopedContext) {
  if (objectType === "LEAD") {
    return { assignedUserId: ctx.userId, assignedTeamId: ctx.teamIds[0] ?? null };
  }
  return { ownerUserId: ctx.userId, teamId: ctx.teamIds[0] ?? null };
}

async function createImported(
  objectType: ImportObjectTypeValue,
  ctx: ScopedContext,
  data: Record<string, unknown>,
  label: string,
): Promise<string> {
  const subjectType = objectType as "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER";
  const base = { ...ownership(objectType, ctx), ...data } as Record<string, unknown>;
  let id: string;
  if (objectType === "LEAD") {
    const statusId =
      (data.statusId as string | undefined) ??
      (await prisma.recordStatus.findFirst({ where: { appliesTo: "LEAD", isDefault: true } }))?.id;
    id = (await prisma.lead.create({ data: { ...base, statusId } as never })).id;
  } else if (objectType === "CONTACT") {
    id = (await prisma.contact.create({ data: base as never })).id;
  } else if (objectType === "ACCOUNT") {
    id = (await prisma.account.create({ data: base as never })).id;
  } else {
    id = (await prisma.customer.create({ data: base as never })).id;
  }
  await appendActivity(prisma, {
    subjectType,
    subjectId: id,
    kind: "imported",
    actorUserId: ctx.userId,
    payload: { label },
  });
  return id;
}

async function updateImported(
  objectType: ImportObjectTypeValue,
  ctx: ScopedContext,
  existingId: string,
  data: Record<string, unknown>,
): Promise<void> {
  // Only mapped fields are written; ownership/status defaults never are.
  const patch = { ...data } as never;
  if (objectType === "LEAD") await prisma.lead.update({ where: { id: existingId }, data: patch });
  else if (objectType === "CONTACT") await prisma.contact.update({ where: { id: existingId }, data: patch });
  else if (objectType === "ACCOUNT") await prisma.account.update({ where: { id: existingId }, data: patch });
  else await prisma.customer.update({ where: { id: existingId }, data: patch });
  await appendActivity(prisma, {
    subjectType: objectType as "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER",
    subjectId: existingId,
    kind: "updated",
    actorUserId: ctx.userId,
    payload: { via: "import" },
  });
}

/** Create the job row and kick off background processing. Returns jobId. */
export async function startImport(ctx: ScopedContext, input: z.infer<typeof StartImportInput>) {
  if (!ctx.permissions.includes("LEADS_IMPORT")) {
    throw new CrmError("Forbidden — LEADS_IMPORT permission required", 403);
  }
  const validation = await validateImport(ctx, input);
  if (validation.issues.some((issue) => issue.level === "error" && issue.row === 0)) {
    throw new CrmError("Fix the mapping first — match-rule columns are missing.", 400, {
      issues: validation.issues.filter((issue) => issue.row === 0),
    });
  }

  const job = await prisma.importJob.create({
    data: {
      source: "CSV",
      objectType: input.objectType,
      status: "RUNNING",
      strategy: input.strategy,
      mapping: input.mapping as never,
      matchRules: input.matchRules as never,
      payload: input.rows as never,
      totalRows: input.rows.length,
      fileKey: input.fileName ?? null,
      createdById: ctx.userId,
      startedAt: new Date(),
    },
  });
  await appendAudit(prisma, {
    actorId: ctx.userId,
    action: "IMPORT_STARTED",
    objectType: "ImportJob",
    objectId: job.id,
    after: { objectType: input.objectType, strategy: input.strategy, rows: input.rows.length },
  });

  void processImportJob(job.id).catch(async (error) => {
    console.error("[crm/import] job failed", job.id, error);
    await prisma.importJob
      .update({ where: { id: job.id }, data: { status: "FAILED", finishedAt: new Date() } })
      .catch(() => undefined);
  });

  return { jobId: job.id };
}

/** Chunked background processor with persisted progress and row errors. */
async function processImportJob(jobId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || !job.payload) return;
  const user = await prisma.user.findUnique({
    where: { id: job.createdById },
    select: {
      id: true,
      status: true,
      name: true,
      role: { select: { key: true, scope: true, permissions: { select: { permission: true } } } },
    },
  });
  if (!user || user.status !== "ACTIVE") {
    await prisma.importJob.update({ where: { id: jobId }, data: { status: "FAILED", finishedAt: new Date() } });
    return;
  }
  const { visibleTeamIds } = await import("@/server/scope");
  const ctx: ScopedContext = {
    userId: user.id,
    name: user.name,
    roleKey: user.role.key,
    scope: user.role.scope,
    permissions: user.role.permissions.map((entry) => entry.permission) as never,
    teamIds: await visibleTeamIds(user.id, user.role.scope),
  };

  const objectType = job.objectType as ImportObjectTypeValue;
  const strategy = job.strategy;
  const mapping = (job.mapping ?? {}) as Record<string, string>;
  const matchRules = MatchRules.parse(job.matchRules ?? {});
  const rows = job.payload as unknown as Array<Record<string, string>>;

  // Re-validate inside the worker (data may have changed since preview).
  const validation = await validateImport(ctx, {
    objectType,
    mapping,
    matchRules,
    rows,
  });
  const duplicateByRow = new Map<number, RowDuplicate>();
  for (const duplicate of validation.duplicates) duplicateByRow.set(duplicate.row, duplicate);
  const issueRows = new Set(validation.issues.filter((i) => i.level === "error").map((i) => i.row));

  const counts: Record<"processed" | "created" | "updated" | "skipped" | "duplicates" | "errors", number> = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    duplicates: 0,
    errors: 0,
  };

  const recordError = async (rowNumber: number, row: Record<string, string>, message: string) => {
    counts.errors += 1;
    await prisma.importError.create({
      data: { jobId, rowNumber, data: row as never, message },
    });
  };
  const recordSkipped = async (rowNumber: number, row: Record<string, string>, message: string) => {
    counts.skipped += 1;
    await prisma.importError.create({
      data: { jobId, rowNumber, data: row as never, message },
    });
  };

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index]!;
    const transformed = validation.transformed[index];
    try {
      if (issueRows.has(rowNumber) || !transformed) {
        await recordError(
          rowNumber,
          row,
          validation.issues.find((issue) => issue.row === rowNumber)?.message ?? "Row failed validation.",
        );
      } else if (duplicateByRow.has(rowNumber)) {
        const duplicate = duplicateByRow.get(rowNumber)!;
        if (strategy === "CREATE") {
          counts.duplicates += 1;
          await prisma.importError.create({
            data: { jobId, rowNumber, data: row as never, message: `Duplicate of “${duplicate.label}” (${duplicate.matchOn}) — skipped.` },
          });
        } else {
          // UPDATE / UPSERT: write mapped fields onto the matched record.
          await updateImported(objectType, ctx, duplicate.existingId, transformed.data);
          counts.updated += 1;
        }
      } else if (strategy === "UPDATE") {
        await recordSkipped(rowNumber, row, "No matching record for UPDATE strategy.");
      } else {
        await createImported(objectType, ctx, transformed.data, transformed.label);
        counts.created += 1;
      }
    } catch (error) {
      await recordError(rowNumber, row, error instanceof Error ? error.message : "Write failed.");
    }
    counts.processed += 1;
    if (counts.processed % CHUNK === 0 || counts.processed === rows.length) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          processedRows: counts.processed,
          createdCount: counts.created,
          updatedCount: counts.updated,
          skippedCount: counts.skipped,
          duplicateCount: counts.duplicates,
          errorCount: counts.errors,
        },
      });
    }
  }

  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });
  await appendAudit(prisma, {
    actorId: ctx.userId,
    action: "IMPORT_COMPLETED",
    objectType: "ImportJob",
    objectId: jobId,
    after: { ...counts },
  });
  await notify({
    recipientUserId: ctx.userId,
    type: "IMPORT_COMPLETED",
    payload: {
      jobId,
      objectType,
      created: counts.created,
      updated: counts.updated,
      skipped: counts.skipped,
      duplicates: counts.duplicates,
      errors: counts.errors,
    },
  });
}

/** Recent jobs for the wizard's history panel. */
export function listJobs(userId: string) {
  return prisma.importJob.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      objectType: true,
      status: true,
      strategy: true,
      totalRows: true,
      processedRows: true,
      createdCount: true,
      updatedCount: true,
      skippedCount: true,
      duplicateCount: true,
      errorCount: true,
      fileKey: true,
      createdAt: true,
      finishedAt: true,
    },
  });
}

export function getJob(userId: string, jobId: string) {
  return prisma.importJob.findFirst({
    where: { id: jobId, createdById: userId },
    select: {
      id: true,
      objectType: true,
      status: true,
      strategy: true,
      totalRows: true,
      processedRows: true,
      createdCount: true,
      updatedCount: true,
      skippedCount: true,
      duplicateCount: true,
      errorCount: true,
      fileKey: true,
      createdAt: true,
      finishedAt: true,
    },
  });
}

/** Error rows as CSV for download. */
export async function errorRowsCsv(userId: string, jobId: string): Promise<string | null> {
  const job = await getJob(userId, jobId);
  if (!job) return null;
  const errors = await prisma.importError.findMany({ where: { jobId }, orderBy: { rowNumber: "asc" } });
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  const lines = ["row,message,data"];
  for (const error of errors) {
    lines.push(
      [String(error.rowNumber), escape(error.message), escape(JSON.stringify(error.data))].join(","),
    );
  }
  return lines.join("\n");
}
