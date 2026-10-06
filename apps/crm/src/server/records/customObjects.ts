import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError, type CrmContext } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { ownerScopeWhere } from "@/server/scope";
import { searchWhere } from "@/server/listQuery";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Admin-defined custom objects. Definitions carry their own field schemas
 * (JSON); records are JSONB documents validated against them — no dynamic
 * DDL, so creating a "Property" or "Vendor" object type is a pure admin
 * operation, not a migration.
 */

// ─────────────────── Definition management (admin) ───────────────────

export const FIELD_TYPES = ["TEXT", "NUMBER", "CURRENCY", "BOOLEAN", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "PHONE", "EMAIL", "URL"] as const;

export const FieldDefSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-zA-Z0-9_]*$/, "Key must be camelCase.").max(40),
  label: z.string().trim().min(1).max(80),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(60)).max(50).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

export const CreateCustomObject = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9-]*$/, "Key must be a lowercase slug (e.g. properties).").max(40),
  name: z.string().trim().min(1).max(60),
  pluralName: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
  fields: z.array(FieldDefSchema).min(1).max(50),
});

export const UpdateCustomObject = CreateCustomObject.partial().extend({ active: z.boolean().optional() });

export async function listCustomObjects(activeOnly = false) {
  return prisma.customObject.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { records: true } } },
  });
}

export async function getCustomObjectByKey(key: string) {
  const definition = await prisma.customObject.findUnique({ where: { key } });
  if (!definition || !definition.active) return null;
  return definition;
}

export async function createCustomObject(ctx: CrmContext, input: z.infer<typeof CreateCustomObject>) {
  const existing = await prisma.customObject.findUnique({ where: { key: input.key } });
  if (existing) throw new CrmError("An object with this key already exists.", 400);
  const reserved = ["leads", "contacts", "accounts", "customers", "opportunities", "tasks", "campaigns", "reports", "admin", "imports", "settings", "search", "login", "api"];
  if (reserved.includes(input.key)) throw new CrmError(`"${input.key}" is a reserved URL path.`, 400);
  return prisma.$transaction(async (tx) => {
    const definition = await tx.customObject.create({
      data: {
        ...input,
        description: input.description ?? null,
        icon: input.icon ?? null,
        fields: input.fields as never,
        sortOrder: (await tx.customObject.count()) + 1,
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_OBJECT_CREATED",
      objectType: "CustomObject",
      objectId: definition.id,
      after: { key: definition.key, name: definition.name, fieldCount: input.fields.length },
    });
    return definition;
  });
}

export async function updateCustomObject(ctx: CrmContext, id: string, input: z.infer<typeof UpdateCustomObject>) {
  const existing = await prisma.customObject.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Custom object not found.", 404);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.customObject.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.pluralName !== undefined ? { pluralName: input.pluralName } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.fields !== undefined ? { fields: input.fields as never } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_OBJECT_UPDATED",
      objectType: "CustomObject",
      objectId: id,
      after: { key: saved.key, name: saved.name, active: saved.active },
    });
    return saved;
  });
}

export async function deleteCustomObject(ctx: CrmContext, id: string) {
  const existing = await prisma.customObject.findUnique({ where: { id }, include: { _count: { select: { records: true } } } });
  if (!existing) throw new CrmError("Custom object not found.", 404);
  if (existing._count.records > 0) {
    throw new CrmError(`Object has ${existing._count.records} record(s) — deactivate it instead of deleting.`, 400);
  }
  await prisma.$transaction(async (tx) => {
    await tx.customObject.delete({ where: { id } });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_OBJECT_DELETED",
      objectType: "CustomObject",
      objectId: id,
      before: { key: existing.key, name: existing.name },
    });
  });
}

// ─────────────────── Record CRUD (scoped) ───────────────────

interface FieldDef {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[] | null;
  sortOrder: number;
}

function parseFields(definition: { fields: Prisma.JsonValue | null }): FieldDef[] {
  if (!definition.fields || !Array.isArray(definition.fields)) return [];
  return definition.fields as unknown as FieldDef[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/;

/** Validate + normalize record data against the definition's field schema. */
function validateData(fields: FieldDef[], data: unknown, mode: "create" | "update"): Record<string, unknown> {
  if (typeof data !== "object" || data === null) throw new CrmError("Record data must be an object.", 400);
  const input = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const field of fields) {
    const value = input[field.key];
    if (value === undefined || value === null || value === "") {
      if (mode === "create" && field.required) {
        throw new CrmError(`Field "${field.label}" is required.`, 400);
      }
      if (mode === "update" && value !== undefined) sanitized[field.key] = null;
      continue;
    }
    const fail = (reason: string) => new CrmError(`Field "${field.label}": ${reason}`, 400);
    switch (field.type) {
      case "TEXT":
        if (typeof value !== "string") throw fail("must be text.");
        sanitized[field.key] = value.trim();
        break;
      case "PHONE":
        if (typeof value !== "string" || !/^\+?[\d\s()\-.]{6,25}$/.test(value)) throw fail("is not a phone number.");
        sanitized[field.key] = value.replace(/[\s()\-.]/g, "");
        break;
      case "EMAIL":
        if (typeof value !== "string" || !EMAIL_RE.test(value)) throw fail("is not an email address.");
        sanitized[field.key] = value.trim().toLowerCase();
        break;
      case "URL":
        if (typeof value !== "string" || !URL_RE.test(value)) throw fail("must be an http(s) URL.");
        sanitized[field.key] = value.trim();
        break;
      case "NUMBER":
      case "CURRENCY": {
        const num = Number(value);
        if (Number.isNaN(num)) throw fail("must be a number.");
        sanitized[field.key] = num;
        break;
      }
      case "BOOLEAN":
        if (typeof value !== "boolean") throw fail("must be true or false.");
        sanitized[field.key] = value;
        break;
      case "DATE":
      case "DATETIME":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw fail("must be a date.");
        sanitized[field.key] = value;
        break;
      case "SELECT": {
        const options = field.options ?? [];
        if (typeof value !== "string" || !options.includes(value)) throw fail(`must be one of: ${options.join(", ")}.`);
        sanitized[field.key] = value;
        break;
      }
      case "MULTI_SELECT": {
        const options = field.options ?? [];
        if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !options.includes(entry))) {
          throw fail(`must only contain: ${options.join(", ")}.`);
        }
        sanitized[field.key] = value;
        break;
      }
      default:
        sanitized[field.key] = value;
    }
  }
  // Reject unknown keys
  for (const key of Object.keys(input)) {
    if (!fields.some((field) => field.key === key)) {
      throw new CrmError(`Unknown field "${key}".`, 400);
    }
  }
  return sanitized;
}

/** Derive a display name from the first required text field. */
function deriveName(fields: FieldDef[], data: Record<string, unknown>): string {
  const nameField = fields.find((field) => field.required && field.type === "TEXT")
    ?? fields.find((field) => field.type === "TEXT");
  if (nameField && data[nameField.key]) return String(data[nameField.key]);
  return "Untitled";
}

export const CreateRecord = z.object({
  data: z.record(z.unknown()),
  externalId: z.string().trim().min(2).max(120).optional().nullable(),
  ownerUserId: z.string().trim().min(5).optional(),
});

export const UpdateRecord = z.object({
  data: z.record(z.unknown()).optional(),
  externalId: z.string().trim().min(2).max(120).optional().nullable(),
  ownerUserId: z.string().trim().min(5).optional(),
});

export async function listRecords(
  ctx: ScopedContext,
  objectKey: string,
  query: { page: number; pageSize: number; q?: string },
) {
  const definition = await getCustomObjectByKey(objectKey);
  if (!definition) throw new CrmError("Unknown object type.", 404);
  const where: Prisma.CustomObjectRecordWhereInput = {
    customObjectId: definition.id,
    deletedAt: null,
    ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
    ...searchWhere(["name", "externalId"], query.q ?? ""),
  };
  const [total, rows] = await Promise.all([
    prisma.customObjectRecord.count({ where }),
    prisma.customObjectRecord.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { definition, total, rows };
}

export async function getRecord(ctx: ScopedContext, objectKey: string, recordId: string) {
  const definition = await getCustomObjectByKey(objectKey);
  if (!definition) throw new CrmError("Unknown object type.", 404);
  const record = await prisma.customObjectRecord.findFirst({
    where: {
      id: recordId,
      customObjectId: definition.id,
      deletedAt: null,
      ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
    },
    include: { owner: { select: { id: true, name: true } }, customObject: true },
  });
  if (!record) throw new CrmError("Record not found.", 404);
  return record;
}

export async function createRecord(
  ctx: ScopedContext,
  objectKey: string,
  input: z.infer<typeof CreateRecord>,
) {
  const definition = await getCustomObjectByKey(objectKey);
  if (!definition) throw new CrmError("Unknown object type.", 404);
  const fields = parseFields(definition);
  const data = validateData(fields, input.data, "create");
  const name = deriveName(fields, data);

  return prisma.$transaction(async (tx) => {
    const record = await tx.customObjectRecord.create({
      data: {
        customObjectId: definition.id,
        name,
        data: data as never,
        ownerUserId: input.ownerUserId ?? ctx.userId,
        assignedTeamId: ctx.teamIds[0] ?? null,
        externalId: input.externalId ?? null,
      },
    });
    await appendActivity(tx, {
      subjectType: "TASK", // generic kind; custom objects don't have a SubjectType enum
      subjectId: record.id,
      kind: "created",
      actorUserId: ctx.userId,
      payload: { objectKey, name },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_RECORD_CREATED",
      objectType: `CustomObject:${definition.key}`,
      objectId: record.id,
      after: { name },
    });
    return record;
  });
}

export async function updateRecord(
  ctx: ScopedContext,
  objectKey: string,
  recordId: string,
  input: z.infer<typeof UpdateRecord>,
) {
  const definition = await getCustomObjectByKey(objectKey);
  if (!definition) throw new CrmError("Unknown object type.", 404);
  const existing = await prisma.customObjectRecord.findFirst({
    where: {
      id: recordId,
      customObjectId: definition.id,
      deletedAt: null,
      ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
    },
  });
  if (!existing) throw new CrmError("Record not found.", 404);

  const fields = parseFields(definition);
  const mergedData = input.data
    ? { ...(existing.data as Record<string, unknown>), ...input.data }
    : (existing.data as Record<string, unknown>);
  const data = validateData(fields, mergedData, "update");
  const name = deriveName(fields, data);

  return prisma.$transaction(async (tx) => {
    const saved = await tx.customObjectRecord.update({
      where: { id: recordId },
      data: {
        name,
        data: data as never,
        ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
      },
    });
    await appendActivity(tx, {
      subjectType: "TASK",
      subjectId: recordId,
      kind: "updated",
      actorUserId: ctx.userId,
      payload: { objectKey },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_RECORD_UPDATED",
      objectType: `CustomObject:${definition.key}`,
      objectId: recordId,
      before: { name: existing.name },
      after: { name: saved.name },
    });
    return saved;
  });
}

export async function softDeleteRecord(ctx: ScopedContext, objectKey: string, recordId: string) {
  const definition = await getCustomObjectByKey(objectKey);
  if (!definition) throw new CrmError("Unknown object type.", 404);
  const existing = await prisma.customObjectRecord.findFirst({
    where: {
      id: recordId,
      customObjectId: definition.id,
      deletedAt: null,
      ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
    },
  });
  if (!existing) throw new CrmError("Record not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.customObjectRecord.update({ where: { id: recordId }, data: { deletedAt: new Date() } });
    await appendActivity(tx, {
      subjectType: "TASK",
      subjectId: recordId,
      kind: "deleted",
      actorUserId: ctx.userId,
      payload: { objectKey },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_RECORD_DELETED",
      objectType: `CustomObject:${definition.key}`,
      objectId: recordId,
      before: { name: existing.name },
    });
  });
}
