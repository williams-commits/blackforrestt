import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError, type CrmContext } from "@/server/guard";
import { appendAudit } from "@/server/audit";

/**
 * Custom fields: admin-defined extensions per object. Definitions live in
 * CustomFieldDef; values live in each record's customFields JSONB and are
 * validated HERE on every write — records services never accept raw JSON.
 */

export const FIELD_TYPES = [
  "TEXT",
  "NUMBER",
  "CURRENCY",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "SELECT",
  "MULTI_SELECT",
  "PHONE",
  "EMAIL",
  "URL",
] as const;

export const CreateCustomField = z.object({
  objectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-zA-Z0-9_]*$/, "Key must be camelCase (letters, digits, underscore; starts lowercase).")
    .max(40),
  label: z.string().trim().min(1).max(80),
  fieldType: z.enum(FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(60)).max(50).optional().nullable(),
  required: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const UpdateCustomField = CreateCustomField.partial().omit({ objectType: true, key: true }).extend({ active: z.boolean().optional() });

export function listCustomFields(activeOnly = false) {
  return prisma.customFieldDef.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ objectType: "asc" }, { sortOrder: "asc" }],
  });
}

export async function createCustomField(ctx: CrmContext, input: z.infer<typeof CreateCustomField>) {
  const existing = await prisma.customFieldDef.findUnique({
    where: { objectType_key: { objectType: input.objectType, key: input.key } },
  });
  if (existing) throw new CrmError("A custom field with this key already exists for this object.", 400);
  if ((input.fieldType === "SELECT" || input.fieldType === "MULTI_SELECT") && (input.options?.length ?? 0) < 1) {
    throw new CrmError("Select fields need at least one option.", 400);
  }
  const field = await prisma.$transaction(async (tx) => {
    const created = await tx.customFieldDef.create({
      data: { ...input, options: (input.options ?? undefined) as never },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_FIELD_CREATED",
      objectType: "CustomFieldDef",
      objectId: created.id,
      after: { objectType: created.objectType, key: created.key, fieldType: created.fieldType },
    });
    return created;
  });
  return field;
}

export async function updateCustomField(ctx: CrmContext, id: string, input: z.infer<typeof UpdateCustomField>) {
  const existing = await prisma.customFieldDef.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Custom field not found.", 404);
  if ((input.fieldType === "SELECT" || input.fieldType === "MULTI_SELECT") && (input.options?.length ?? 0) < 1) {
    throw new CrmError("Select fields need at least one option.", 400);
  }
  return prisma.$transaction(async (tx) => {
    const saved = await tx.customFieldDef.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.fieldType !== undefined ? { fieldType: input.fieldType } : {}),
        ...(input.options !== undefined ? { options: (input.options ?? undefined) as never } : {}),
        ...(input.required !== undefined ? { required: input.required } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_FIELD_UPDATED",
      objectType: "CustomFieldDef",
      objectId: id,
      after: { label: saved.label, fieldType: saved.fieldType, active: saved.active },
    });
    return saved;
  });
}

export async function deleteCustomField(ctx: CrmContext, id: string) {
  const existing = await prisma.customFieldDef.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Custom field not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.customFieldDef.delete({ where: { id } });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "CUSTOM_FIELD_DELETED",
      objectType: "CustomFieldDef",
      objectId: id,
      before: { objectType: existing.objectType, key: existing.key },
    });
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/;

function validateValue(
  def: { key: string; label: string; fieldType: string; options: Prisma.JsonValue | null },
  value: unknown,
): unknown {
  const fail = (reason: string) => new CrmError(`Custom field “${def.label}”: ${reason}`, 400);
  switch (def.fieldType) {
    case "TEXT":
    case "PHONE": {
      if (typeof value !== "string") throw fail("must be text.");
      if (def.fieldType === "PHONE" && !/^\+?[\d\s()\-.]{6,25}$/.test(value)) throw fail("is not a phone number.");
      return value.trim();
    }
    case "EMAIL":
      if (typeof value !== "string" || !EMAIL_RE.test(value)) throw fail("is not an email address.");
      return value.trim().toLowerCase();
    case "URL":
      if (typeof value !== "string" || !URL_RE.test(value)) throw fail("must be an http(s) URL.");
      return value.trim();
    case "NUMBER":
    case "CURRENCY":
      if (typeof value !== "number" || !Number.isFinite(value)) throw fail("must be a number.");
      return value;
    case "BOOLEAN":
      if (typeof value !== "boolean") throw fail("must be true or false.");
      return value;
    case "DATE":
    case "DATETIME": {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw fail("must be a date.");
      return value;
    }
    case "SELECT": {
      const options = Array.isArray(def.options) ? def.options.map(String) : [];
      if (typeof value !== "string" || !options.includes(value)) {
        throw fail(`must be one of: ${options.join(", ")}.`);
      }
      return value;
    }
    case "MULTI_SELECT": {
      const options = Array.isArray(def.options) ? def.options.map(String) : [];
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !options.includes(entry))) {
        throw fail(`must only contain: ${options.join(", ")}.`);
      }
      return value;
    }
    default:
      throw fail("has an unsupported type.");
  }
}

/**
 * Validate a customFields payload against the object's active definitions.
 * Unknown keys are rejected (never silently dropped); missing required
 * fields are rejected in create mode. Returns the sanitized object, or
 * undefined when no payload was provided (update = leave unchanged).
 */
export async function sanitizeCustomFields(
  objectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY",
  input: unknown,
  mode: "create" | "update",
): Promise<Record<string, unknown> | undefined> {
  if (input === undefined) return undefined;
  if (input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new CrmError("customFields must be an object.", 400);
  }
  const defs = await prisma.customFieldDef.findMany({
    where: { objectType, active: true },
  });
  const defByKey = new Map(defs.map((def) => [def.key, def]));
  const entries = Object.entries(input as Record<string, unknown>);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    const def = defByKey.get(key);
    if (!def) throw new CrmError(`Unknown custom field “${key}”.`, 400);
    if (value === null || value === "") {
      if (mode === "create" && def.required) {
        throw new CrmError(`Custom field “${def.label}” is required.`, 400);
      }
      sanitized[key] = null;
      continue;
    }
    sanitized[key] = validateValue(def, value);
  }
  if (mode === "create") {
    for (const def of defs) {
      if (def.required && !(def.key in sanitized)) {
        throw new CrmError(`Custom field “${def.label}” is required.`, 400);
      }
    }
  }
  return sanitized;
}
