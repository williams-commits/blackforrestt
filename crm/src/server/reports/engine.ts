import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Reusable report engine. Reports are DATA (definitions in prebuilt.ts),
 * not pages: one executor renders every report with the same guarantees —
 * whitelisted tables/columns only, parameterized SQL, and the actor's data
 * scope applied to every row. A future report BUILDER UI can emit the same
 * definition shape.
 */

export type ReportObject = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY" | "TASK";
export type TimeUnit = "day" | "week" | "month";

export interface ReportGroupBy {
  /** Logical key resolved to a whitelisted SQL expression below. */
  key: string;
  /** When set, the group key is a date_trunc bucket of the key's column. */
  timeUnit?: TimeUnit;
}

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  object: ReportObject;
  /** Whitelisted date column the range filters on. */
  dateField: string;
  groupBy: ReportGroupBy;
  /** sum aggregations beyond the implicit count; whitelisted numeric columns. */
  sums?: string[];
  /** Extra fixed conditions (per-report, not user input). */
  fixed?: { convertedOnly?: boolean; openOnly?: boolean; wonOnly?: boolean };
  /** Default sort: time buckets ascend, everything else by count desc. */
}

interface ObjectSpec {
  table: string;
  /** logical key → SQL expression (joins declared in joinSql). */
  groupExpr: Record<string, string>;
  dateFields: string[];
  sumFields: string[];
  /** logical key → JOIN clause. */
  joins: Record<string, string>;
}

const OBJECTS: Record<ReportObject, ObjectSpec> = {
  LEAD: {
    table: '"Lead"',
    groupExpr: {
      source: `"Lead"."source"`,
      priority: `"Lead"."priority"`,
      country: `"Lead"."country"`,
      statusName: `rs."name"`,
      assignee: `u."name"`,
      campaignName: `c."name"`,
      createdAt: `"Lead"."createdAt"`,
      convertedAt: `"Lead"."convertedAt"`,
    },
    dateFields: ["createdAt", "updatedAt", "convertedAt"],
    sumFields: ["score"],
    joins: {
      statusName: `LEFT JOIN "RecordStatus" rs ON rs."id" = "Lead"."statusId"`,
      assignee: `LEFT JOIN "User" u ON u."id" = "Lead"."assignedUserId"`,
      campaignName: `LEFT JOIN "Campaign" c ON c."id" = "Lead"."campaignId"`,
    },
  },
  CONTACT: {
    table: '"Contact"',
    groupExpr: { leadSource: `"Contact"."leadSource"`, owner: `u."name"`, account: `a."name"` },
    dateFields: ["createdAt", "updatedAt"],
    sumFields: [],
    joins: {
      owner: `LEFT JOIN "User" u ON u."id" = "Contact"."ownerUserId"`,
      account: `LEFT JOIN "Account" a ON a."id" = "Contact"."accountId"`,
    },
  },
  ACCOUNT: {
    table: '"Account"',
    groupExpr: { industry: `"Account"."industry"`, country: `"Account"."country"`, owner: `u."name"` },
    dateFields: ["createdAt", "updatedAt"],
    sumFields: ["revenue"],
    joins: { owner: `LEFT JOIN "User" u ON u."id" = "Account"."ownerUserId"` },
  },
  CUSTOMER: {
    table: '"Customer"',
    groupExpr: { source: `"Customer"."source"`, statusName: `rs."name"`, owner: `u."name"` },
    dateFields: ["createdAt", "updatedAt"],
    sumFields: [],
    joins: {
      statusName: `LEFT JOIN "RecordStatus" rs ON rs."id" = "Customer"."statusId"`,
      owner: `LEFT JOIN "User" u ON u."id" = "Customer"."ownerUserId"`,
    },
  },
  OPPORTUNITY: {
    table: '"Opportunity"',
    groupExpr: {
      stageName: `ps."name"`,
      pipelineName: `p."name"`,
      owner: `u."name"`,
      status: `"Opportunity"."status"`,
      createdAt: `"Opportunity"."createdAt"`,
      closedAt: `"Opportunity"."closedAt"`,
      expectedCloseAt: `"Opportunity"."expectedCloseAt"`,
    },
    dateFields: ["createdAt", "updatedAt", "closedAt", "expectedCloseAt"],
    sumFields: ["value", "probability"],
    joins: {
      stageName: `LEFT JOIN "PipelineStage" ps ON ps."id" = "Opportunity"."stageId"`,
      pipelineName: `LEFT JOIN "Pipeline" p ON p."id" = "Opportunity"."pipelineId"`,
      owner: `LEFT JOIN "User" u ON u."id" = "Opportunity"."ownerUserId"`,
    },
  },
  TASK: {
    table: '"Task"',
    groupExpr: {
      owner: `u."name"`,
      status: `"Task"."status"`,
      priority: `"Task"."priority"`,
      createdAt: `"Task"."createdAt"`,
      dueAt: `"Task"."dueAt"`,
      completedAt: `"Task"."completedAt"`,
    },
    dateFields: ["createdAt", "dueAt", "completedAt"],
    sumFields: [],
    joins: { owner: `LEFT JOIN "User" u ON u."id" = "Task"."ownerUserId"` },
  },
};

/** Scope SQL per object — the same visibility rules as list views.
 *  NOTE: plain strings interpolate as BIND PARAMETERS inside Prisma.sql
 *  templates; identifiers must go through Prisma.raw. */
function scopeSql(ctx: ScopedContext, object: ReportObject): Prisma.Sql {
  if (ctx.scope === "ORG") return Prisma.sql`TRUE`;
  const userId = ctx.userId;
  if (object === "LEAD") {
    if (ctx.scope === "OWN") return Prisma.sql`"Lead"."assignedUserId" = ${userId}`;
    if (ctx.teamIds.length === 0) return Prisma.sql`"Lead"."assignedUserId" = ${userId}`;
    return Prisma.sql`("Lead"."assignedUserId" = ${userId} OR "Lead"."assignedTeamId" IN (${Prisma.join(ctx.teamIds)}))`;
  }
  const table = Prisma.raw(OBJECTS[object].table);
  if (ctx.scope === "OWN") return Prisma.sql`${table}."ownerUserId" = ${userId}`;
  if (ctx.teamIds.length === 0) return Prisma.sql`${table}."ownerUserId" = ${userId}`;
  return Prisma.sql`(${table}."ownerUserId" = ${userId} OR ${table}."teamId" IN (${Prisma.join(ctx.teamIds)}))`;
}

export interface ReportRow {
  key: string | null;
  count: number;
  sums: Record<string, number | null>;
}

export interface RunReportInput {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Execute a report definition. All identifiers come from the whitelists
 * above; all VALUES are bound parameters. Scope is always applied.
 */
export async function runReport(
  ctx: ScopedContext,
  def: ReportDef,
  input: RunReportInput,
): Promise<ReportRow[]> {
  const spec = OBJECTS[def.object];
  const groupExpr = spec.groupExpr[def.groupBy.key];
  if (!groupExpr) throw new Error(`Report ${def.id}: unknown group key ${def.groupBy.key}`);
  if (!spec.dateFields.includes(def.dateField)) {
    throw new Error(`Report ${def.id}: date field not allowed`);
  }
  const joinSql = def.groupBy.key in spec.joins ? spec.joins[def.groupBy.key]! : "";

  const dateColumn = `${spec.table}."${def.dateField}"`;
  const fromDate = input.dateFrom ? new Date(input.dateFrom) : null;
  const toDate = input.dateTo ? new Date(input.dateTo) : null;

  const conditions: Prisma.Sql[] = [scopeSql(ctx, def.object)];
  // Only the core record objects are soft-deleted; Task has no deletedAt.
  // Table identifiers interpolate via Prisma.raw (see scopeSql note).
  if (def.object !== "TASK") {
    conditions.push(Prisma.sql`${Prisma.raw(spec.table)}."deletedAt" IS NULL`);
  }
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    conditions.push(Prisma.sql`${Prisma.raw(dateColumn)} >= ${fromDate.toISOString()}`);
  }
  if (toDate && !Number.isNaN(toDate.getTime())) {
    conditions.push(Prisma.sql`${Prisma.raw(dateColumn)} < ${toDate.toISOString()}`);
  }
  if (def.fixed?.convertedOnly) conditions.push(Prisma.sql`${Prisma.raw(spec.table)}."convertedAt" IS NOT NULL`);
  if (def.fixed?.wonOnly) conditions.push(Prisma.sql`${Prisma.raw(spec.table)}."status" = 'WON'`);
  if (def.fixed?.openOnly) conditions.push(Prisma.sql`${Prisma.raw(spec.table)}."status" = 'OPEN'`);
  // Time buckets of NULL dates are meaningless — exclude them.
  if (def.groupBy.timeUnit) {
    conditions.push(Prisma.sql`${Prisma.raw(dateColumn)} IS NOT NULL`);
  }

  const groupSelect = def.groupBy.timeUnit
    ? Prisma.sql`date_trunc(${Prisma.raw(`'${def.groupBy.timeUnit}'`)}, ${Prisma.raw(groupExpr)})`
    : Prisma.raw(groupExpr);

  const sumSelects = (def.sums ?? [])
    .map((field) => {
      if (!spec.sumFields.includes(field)) throw new Error(`Report ${def.id}: sum field not allowed`);
      return `COALESCE(SUM(${field === "value" || field === "revenue" ? `${spec.table}."${field}"::numeric` : `${spec.table}."${field}"`}), 0) AS sum_${field}`;
    })
    .join(", ");

  const query = Prisma.sql`
    SELECT ${groupSelect} AS group_key, COUNT(*)::int AS count${sumSelects ? Prisma.raw(`, ${sumSelects}`) : Prisma.empty}
    FROM ${Prisma.raw(spec.table)}
    ${joinSql ? Prisma.raw(joinSql) : Prisma.empty}
    WHERE ${Prisma.join(conditions, " AND ")}
    GROUP BY 1
    ORDER BY ${def.groupBy.timeUnit ? Prisma.sql`1 ASC` : Prisma.sql`COUNT(*) DESC`}
    LIMIT 200
  `;

  const rows = (await prisma.$queryRaw(query)) as Array<{
    group_key: string | Date | null;
    count: number;
    [sum: string]: number | string | Date | null;
  }>;

  return rows.map((row) => {
    const sums: Record<string, number | null> = {};
    for (const field of def.sums ?? []) {
      const value = row[`sum_${field}`];
      sums[field] = value === null || value === undefined ? null : Number(value);
    }
    const key =
      row.group_key instanceof Date
        ? row.group_key.toISOString().slice(0, def.groupBy.timeUnit === "day" ? 10 : 7)
        : (row.group_key as string | null);
    return { key: key ?? null, count: Number(row.count), sums };
  });
}

export function reportObjectLabel(object: ReportObject): string {
  return object.charAt(0) + object.slice(1).toLowerCase();
}
