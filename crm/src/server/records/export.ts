import { prisma } from "@/server/db";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
import { searchWhere } from "@/server/listQuery";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Scope-respecting CSV exports for the core record objects. An export is a
 * read path like any other: identical filters, identical data scope — a
 * user can never export rows they cannot see. Capped at 10k rows per
 * export (larger sets belong to a future async export job).
 */

export const EXPORT_LIMIT = 10_000;

type ExportObject = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER";

const escape = (value: unknown): string => {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

function toCsv(header: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((column) => escape(row[column])).join(","));
  }
  return lines.join("\n");
}

export async function exportRecords(
  ctx: ScopedContext,
  object: ExportObject,
  query: { q?: string; statusId?: string },
): Promise<string> {
  const leadScope = assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
  const ownerScope = ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);

  if (object === "LEAD") {
    const rows = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        convertedAt: null,
        ...leadScope,
        ...(query.statusId ? { statusId: query.statusId } : {}),
        ...searchWhere(["firstName", "lastName", "email", "phone", "company", "externalId"], query.q ?? ""),
      },
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT,
      include: {
        status: { select: { name: true } },
        assignedUser: { select: { name: true } },
      },
    });
    return toCsv(
      ["id", "firstName", "lastName", "email", "phone", "company", "country", "source", "status", "score", "priority", "assignee", "externalId", "createdAt"],
      rows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        company: row.company,
        country: row.country,
        source: row.source,
        status: row.status.name,
        score: row.score,
        priority: row.priority,
        assignee: row.assignedUser?.name ?? "",
        externalId: row.externalId,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }
  if (object === "CONTACT") {
    const rows = await prisma.contact.findMany({
      where: {
        deletedAt: null,
        ...ownerScope,
        ...(query.statusId ? { statusId: query.statusId } : {}),
        ...searchWhere(["firstName", "lastName", "email", "phone", "jobTitle"], query.q ?? ""),
      },
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT,
      include: { owner: { select: { name: true } }, account: { select: { name: true } } },
    });
    return toCsv(
      ["id", "firstName", "lastName", "email", "phone", "jobTitle", "account", "owner", "createdAt"],
      rows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        jobTitle: row.jobTitle,
        account: row.account?.name ?? "",
        owner: row.owner.name,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }
  if (object === "ACCOUNT") {
    const rows = await prisma.account.findMany({
      where: {
        deletedAt: null,
        ...ownerScope,
        ...searchWhere(["name", "industry", "city", "country"], query.q ?? ""),
      },
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT,
      include: { owner: { select: { name: true } } },
    });
    return toCsv(
      ["id", "name", "industry", "companySize", "website", "city", "country", "owner", "createdAt"],
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        industry: row.industry,
        companySize: row.companySize,
        website: row.website,
        city: row.city,
        country: row.country,
        owner: row.owner.name,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }
  const rows = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...ownerScope,
      ...(query.statusId ? { statusId: query.statusId } : {}),
      ...searchWhere(["firstName", "lastName", "email", "phone"], query.q ?? ""),
    },
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    include: { owner: { select: { name: true } } },
  });
  return toCsv(
    ["id", "firstName", "lastName", "email", "phone", "source", "platformUserId", "owner", "createdAt"],
    rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      source: row.source,
      platformUserId: row.platformUserId ?? "",
      owner: row.owner.name,
      createdAt: row.createdAt.toISOString(),
    })),
  );
}
