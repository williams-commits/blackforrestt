import { createHash } from "node:crypto";
import type { AuditDomain, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { stableJson } from "@/server/ledger";

export { redactAuditValue } from "@/server/auditRedaction";
import { redactAuditValue } from "@/server/auditRedaction";

export interface AuditQuery {
  domain?: AuditDomain;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  beforeSequence?: bigint;
}

export async function listAuditEvents(query: AuditQuery = {}) {
  const limit = Math.min(500, Math.max(1, query.limit ?? 100));
  const events = await prisma.auditEvent.findMany({
    where: {
      domain: query.domain,
      actorId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action ? { contains: query.action, mode: "insensitive" } : undefined,
      sequence: query.beforeSequence ? { lt: query.beforeSequence } : undefined,
      createdAt:
        query.from || query.to
          ? { gte: query.from, lte: query.to }
          : undefined,
    },
    orderBy: { sequence: "desc" },
    take: limit,
  });
  return events.map((event) => ({
    sequence: event.sequence.toString(),
    schemaVersion: event.schemaVersion,
    domain: event.domain,
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    requestId: event.requestId,
    metadata: redactAuditValue(event.metadata),
    previousHash: event.previousHash,
    eventHash: event.eventHash,
    createdAt: event.createdAt.toISOString(),
  }));
}

function legacyPayload(event: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Prisma.JsonValue | null;
  previousHash: string | null;
  createdAt: Date;
}) {
  return {
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    metadata: event.metadata,
    previousHash: event.previousHash,
    createdAt: event.createdAt.toISOString(),
  };
}

function v2Payload(event: {
  schemaVersion: number;
  domain: AuditDomain;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  metadata: Prisma.JsonValue | null;
  previousHash: string | null;
  createdAt: Date;
}) {
  return {
    schemaVersion: event.schemaVersion,
    domain: event.domain,
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    requestId: event.requestId,
    metadata: event.metadata,
    previousHash: event.previousHash,
    createdAt: event.createdAt.toISOString(),
  };
}

export async function verifyAuditChain(options: { maxEvents?: number } = {}) {
  const maxEvents = Math.min(1_000_000, Math.max(1, options.maxEvents ?? 100_000));
  const events = await prisma.auditEvent.findMany({
    orderBy: { sequence: "asc" },
    take: maxEvents + 1,
  });
  const truncated = events.length > maxEvents;
  if (truncated) events.pop();

  const failures: Array<{ sequence: string; reason: string }> = [];
  let previousHash: string | null = null;
  for (const event of events) {
    if (event.previousHash !== previousHash) {
      failures.push({
        sequence: event.sequence.toString(),
        reason: `previousHash mismatch; expected ${previousHash ?? "null"}`,
      });
    }
    const payload = event.schemaVersion >= 2 ? v2Payload(event) : legacyPayload(event);
    const expected = createHash("sha256").update(stableJson(payload)).digest("hex");
    if (expected !== event.eventHash) {
      failures.push({ sequence: event.sequence.toString(), reason: "eventHash mismatch" });
    }
    previousHash = event.eventHash;
  }

  return {
    valid: failures.length === 0 && !truncated,
    checkedEvents: events.length,
    firstSequence: events[0]?.sequence.toString() ?? null,
    lastSequence: events.at(-1)?.sequence.toString() ?? null,
    headHash: previousHash,
    truncated,
    failures: failures.slice(0, 100),
    verifiedAt: new Date().toISOString(),
  };
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  // Prevent spreadsheet formula execution when an audit export is opened.
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function auditEventsToCsv(events: Awaited<ReturnType<typeof listAuditEvents>>): string {
  const header = [
    "sequence",
    "schemaVersion",
    "domain",
    "actorId",
    "action",
    "entityType",
    "entityId",
    "requestId",
    "createdAt",
    "previousHash",
    "eventHash",
    "metadata",
  ];
  const rows = events.map((event) =>
    [
      event.sequence,
      event.schemaVersion,
      event.domain,
      event.actorId,
      event.action,
      event.entityType,
      event.entityId,
      event.requestId,
      event.createdAt,
      event.previousHash,
      event.eventHash,
      event.metadata,
    ]
      .map(csvCell)
      .join(","),
  );
  return `${header.join(",")}\n${rows.join("\n")}\n`;
}

export function auditEventsToNdjson(events: Awaited<ReturnType<typeof listAuditEvents>>): string {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}
