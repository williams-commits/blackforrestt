import { createHash, randomUUID } from "node:crypto";
import { prisma, withSerializableRetry } from "../db";
import { appendAuditEvent } from "../ledger";
import {
  deleteObject,
  headObject,
  copyToSealed,
  putQuarantineObject,
  quarantineBucket,
  readObjectBuffer,
  sealedBucket,
} from "../storage";
import { getScanner, type ScanStatus } from "./scanner";
import { hashNetworkIdentifier } from "./crypto";
import { KYC_DOCUMENT_TYPE_VALUES, type KycDocumentType } from "@/lib/kyc";

/**
 * KYC document lifecycle:
 *
 *   requestUpload -> browser PUTs bytes to quarantine (presigned, SSE-signed)
 *   finalizeUpload -> server verifies size/MIME/SHA-256, scans, copies to
 *                     sealed, commits metadata, then removes quarantine
 *
 * Only an opaque storage key and metadata are ever persisted — never object
 * bytes or a public URL.
 */

export const ALLOWED_DOC_TYPES = KYC_DOCUMENT_TYPE_VALUES;
export type KycDocType = KycDocumentType;

/** Resolve a user's own KYC submission, creating a draft if none exists. */
export async function ensureOwnSubmission(userId: string) {
  const existing = await prisma.kycSubmission.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.kycSubmission.create({
    data: { userId, status: "NOT_SUBMITTED" },
  });
}

/** Types a KYC document may resolve to, from magic bytes (see resolveDocumentMime). */
type AllowedMime = "image/jpeg" | "image/png" | "application/pdf";

function maxBytes(): number {
  const n = Number(process.env.KYC_MAX_BYTES ?? 10_485_760);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10_485_760;
}

function retentionDays(): number {
  const n = Number(process.env.KYC_RETENTION_DAYS ?? 2555);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2555;
}

/** Magic-byte sniffing so a declared MIME cannot lie about content. */
function detectMime(bytes: Buffer): AllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  return null;
}

/**
 * Resolve the document's type from its magic bytes. The declared MIME is
 * ignored for acceptance: browsers derive file.type from OS registry mappings,
 * where `.jpeg` files often carry an exotic non-empty type that would wrongly
 * reject a genuine JPEG (while `.jpg` maps to image/jpeg and passes). Content
 * sniffing removes that dependency; finalize re-sniffs the stored object, so
 * storage tampering between receive and finalize is still blocked.
 */
function resolveDocumentMime(bytes: Buffer): AllowedMime {
  const detected = detectMime(bytes);
  if (detected) return detected;
  throw new KycDocumentError("Unsupported document type. Only JPEG, PNG, and PDF are accepted.", 400);
}

export class KycDocumentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "KycDocumentError";
  }
}

export interface ReceiveUploadInput {
  userId: string;
  kycSubmissionId: string;
  docType: string;
  bytes: Buffer;
}

export interface ReceiveUploadResult {
  documentId: string;
  version: number;
}

/**
 * Receive an uploaded document through the app (same-origin) and write its bytes
 * straight to the private quarantine bucket with SSE applied. The submission
 * must be in a state where documents may still be added (not APPROVED). The
 * document stays PENDING_SCAN until finalize verifies size/MIME/SHA-256, scans,
 * and moves it into the sealed bucket.
 */
export async function receiveUpload(input: ReceiveUploadInput): Promise<ReceiveUploadResult> {
  if (!(ALLOWED_DOC_TYPES as readonly string[]).includes(input.docType)) {
    throw new KycDocumentError("Invalid document type.");
  }
  if (input.bytes.length <= 0 || input.bytes.length > maxBytes()) {
    throw new KycDocumentError(`Document size must be between 1 and ${maxBytes()} bytes.`);
  }
  const declaredMime = resolveDocumentMime(input.bytes);

  const submission = await prisma.kycSubmission.findUnique({
    where: { id: input.kycSubmissionId },
    select: { userId: true, status: true },
  });
  if (!submission || submission.userId !== input.userId) {
    throw new KycDocumentError("KYC submission not found.", 404);
  }
  if (submission.status === "APPROVED") {
    throw new KycDocumentError("Approved identity documents cannot be replaced without a compliance review.", 409);
  }

  // version = max existing version for this user/docType + 1 (replacement)
  const prior = await prisma.kycDocument.findFirst({
    where: { userId: input.userId, docType: input.docType, deletedAt: null },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const id = randomUUID();
  const version = (prior?.version ?? 0) + 1;
  const storageKey = `kyc/${input.userId}/${id}/v${version}`;

  // Stream the bytes to the quarantine bucket (SSE applied by the storage layer).
  await putQuarantineObject({ key: storageKey, contentType: declaredMime, bytes: input.bytes });

  try {
    const doc = await withSerializableRetry(async (tx) => {
      const created = await tx.kycDocument.create({
        data: {
          id,
          userId: input.userId,
          kycSubmissionId: input.kycSubmissionId,
          storageKey,
          bucket: quarantineBucket(),
          docType: input.docType,
          declaredMime,
          sizeBytes: input.bytes.length,
          // SHA-256 is filled at finalize; a placeholder keeps the NOT NULL column honest.
          sha256: "pending",
          status: "PENDING_SCAN",
          version,
        },
      });
      await appendAuditEvent(tx, {
        actorId: input.userId,
        action: "KYC_DOCUMENT_RECEIVED",
        entityType: "KycDocument",
        entityId: created.id,
        metadata: { docType: input.docType, declaredMime, sizeBytes: input.bytes.length, version },
      });
      return created;
    }, { operation: `receive KYC document ${id}` });
    return { documentId: doc.id, version };
  } catch (error) {
    // The object was written before PostgreSQL so bytes never pass through the
    // database. Remove it when the durable row/audit transaction cannot commit.
    await deleteObject({ key: storageKey, bucket: quarantineBucket() }).catch(() => undefined);
    throw error;
  }
}

export interface FinalizeResult {
  documentId: string;
  status: ScanStatus;
  sha256: string;
  sizeBytes: number;
  detectedMime: string;
}

export type FinalizeOutcome =
  | { kind: "ok"; result: FinalizeResult }
  | { kind: "not_found" }
  | { kind: "conflict"; message: string };

/**
 * Server-authoritative verification. Reads the actual object, checks size/MIME
 * by magic bytes, computes SHA-256, scans, and safely promotes quarantine -> sealed.
 * On any verification or scan failure the quarantine object is deleted and the
 * document transitions to BLOCKED.
 */
export async function finalizeUpload(input: {
  documentId: string;
  userId: string;
}): Promise<FinalizeOutcome> {
  const doc = await prisma.kycDocument.findUnique({
    where: { id: input.documentId },
    select: {
      id: true,
      userId: true,
      storageKey: true,
      bucket: true,
      declaredMime: true,
      sizeBytes: true,
      status: true,
      docType: true,
      kycSubmissionId: true,
    },
  });
  if (!doc || doc.userId !== input.userId) return { kind: "not_found" };
  if (doc.status !== "PENDING_SCAN") {
    return { kind: "conflict", message: "This document has already been finalized." };
  }

  // Verify the object exists with the declared size before streaming.
  let head: { sizeBytes: number; contentType?: string };
  try {
    head = await headObject({ key: doc.storageKey, bucket: doc.bucket });
  } catch {
    return { kind: "conflict", message: "Uploaded object was not found in quarantine. Please re-upload." };
  }
  if (head.sizeBytes !== doc.sizeBytes) {
    await failDocument(doc.id, "UPLOADED_SIZE_MISMATCH");
    await deleteObject({ key: doc.storageKey, bucket: doc.bucket }).catch(() => undefined);
    return { kind: "conflict", message: "Uploaded size does not match the declared size." };
  }

  // Stream once for hash + magic-byte sniff + scan.
  const bytes = await readObjectBuffer({ key: doc.storageKey, bucket: doc.bucket });
  const detected = detectMime(bytes);
  if (!detected || detected !== doc.declaredMime) {
    await failDocument(doc.id, "MIME_MISMATCH");
    await deleteObject({ key: doc.storageKey, bucket: doc.bucket }).catch(() => undefined);
    return { kind: "conflict", message: "Document content does not match its declared type." };
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const scan = await getScanner().scan({ key: doc.storageKey, sizeBytes: bytes.length, sha256, bytes });

  if (scan.status === "BLOCKED" || scan.status === "QUARANTINED") {
    await prisma.$transaction(async (tx) => {
      await tx.kycDocument.update({
        where: { id: doc.id },
        data: { status: scan.status === "BLOCKED" ? "BLOCKED" : "QUARANTINED", detectedMime: detected, sha256, finalizedAt: new Date() },
      });
      await appendAuditEvent(tx, {
        actorId: doc.userId,
        action: "KYC_DOCUMENT_BLOCKED",
        entityType: "KycDocument",
        entityId: doc.id,
        metadata: { reason: scan.reason, sha256, detectedMime: detected },
      });
    }, { isolationLevel: "Serializable" });
    await deleteObject({ key: doc.storageKey, bucket: doc.bucket }).catch(() => undefined);
    return {
      kind: "ok",
      result: { documentId: doc.id, status: scan.status, sha256, sizeBytes: bytes.length, detectedMime: detected },
    };
  }

  // CLEAN: copy first, commit the authoritative database state, then remove
  // quarantine. A failed database transaction leaves the source intact so the
  // operation can be retried without orphaning the sealed copy.
  const sealed = await copyToSealed({ key: doc.storageKey });
  await withSerializableRetry(async (tx) => {
    const updated = await tx.kycDocument.updateMany({
      where: { id: doc.id, status: "PENDING_SCAN", bucket: doc.bucket },
      data: { status: "CLEAN", detectedMime: detected, sha256, finalizedAt: new Date(), bucket: sealed.bucket },
    });
    if (updated.count !== 1) {
      throw new KycDocumentError("Document state changed while finalizing. Please refresh and retry.", 409);
    }
    await appendAuditEvent(tx, {
      actorId: doc.userId,
      action: "KYC_DOCUMENT_FINALIZED",
      entityType: "KycDocument",
      entityId: doc.id,
      metadata: { sha256, sizeBytes: bytes.length, detectedMime: detected, bucket: sealed.bucket },
    });
  }, { operation: `finalize KYC document ${doc.id}` });
  await deleteObject({ key: doc.storageKey, bucket: doc.bucket }).catch((error) => {
    console.warn(`Unable to remove finalized KYC quarantine copy ${doc.id}:`, error);
  });

  return {
    kind: "ok",
    result: { documentId: doc.id, status: "CLEAN", sha256, sizeBytes: bytes.length, detectedMime: detected },
  };
}

async function failDocument(documentId: string, reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.kycDocument.update({
      where: { id: documentId },
      data: { status: "BLOCKED", finalizedAt: new Date() },
    });
    await appendAuditEvent(tx, {
      action: "KYC_DOCUMENT_REJECTED",
      entityType: "KycDocument",
      entityId: documentId,
      metadata: { reason },
    });
  }, { isolationLevel: "Serializable" });
}

export interface PublicDocument {
  id: string;
  docType: string;
  status: string;
  version: number;
  sha256: string;
  sizeBytes: number;
  detectedMime: string | null;
  declaredMime: string;
  uploadedAt: Date;
  finalizedAt: Date | null;
}

/** List a user's documents. Never includes bytes or a usable URL. */
export async function listDocuments(userId: string): Promise<PublicDocument[]> {
  const rows = await prisma.kycDocument.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.id,
    docType: row.docType,
    status: row.status,
    version: row.version,
    sha256: row.sha256 === "pending" ? "" : row.sha256,
    sizeBytes: row.sizeBytes,
    detectedMime: row.detectedMime,
    declaredMime: row.declaredMime,
    uploadedAt: row.uploadedAt,
    finalizedAt: row.finalizedAt,
  }));
}

/**
 * Authorize compliance review of a CLEAN, sealed document: record who/why in
 * KycDocumentAccess and the audit chain, then return the object bytes for the
 * app to stream to the reviewer (same-origin, so no provider CORS is needed).
 */
export async function complianceDownload(input: {
  documentId: string;
  actorId: string;
  reason: string;
  networkAddress?: string | null;
}): Promise<{ bytes: Buffer; contentType: string; documentId: string; docType: string } | null> {
  const doc = await prisma.kycDocument.findUnique({
    where: { id: input.documentId },
    select: { id: true, status: true, storageKey: true, userId: true, deletedAt: true, docType: true, detectedMime: true, declaredMime: true },
  });
  if (!doc || doc.deletedAt || doc.status !== "CLEAN") return null;

  await prisma.$transaction(async (tx) => {
    await tx.kycDocumentAccess.create({
      data: {
        documentId: doc.id,
        actorId: input.actorId,
        reason: input.reason.slice(0, 500),
        ipHash: input.networkAddress ? hashNetworkIdentifier(input.networkAddress) : null,
      },
    });
    await appendAuditEvent(tx, {
      actorId: input.actorId,
      action: "KYC_DOCUMENT_ACCESSED",
      entityType: "KycDocument",
      entityId: doc.id,
      metadata: { reason: input.reason.slice(0, 500), ownerId: doc.userId },
    });
  }, { isolationLevel: "Serializable" });

  const bytes = await readObjectBuffer({ key: doc.storageKey, bucket: sealedBucket() });
  return { bytes, contentType: doc.detectedMime ?? doc.declaredMime, documentId: doc.id, docType: doc.docType };
}

/** Cancel a not-yet-cleaned upload: delete the quarantine object and the row. */
export async function cancelUpload(input: {
  documentId: string;
  userId: string;
}): Promise<boolean> {
  return prisma
    .$transaction(async (tx) => {
      const doc = await tx.kycDocument.findUnique({
        where: { id: input.documentId },
        select: { id: true, userId: true, status: true, storageKey: true, bucket: true },
      });
      if (!doc || doc.userId !== input.userId) return false;
      if (doc.status !== "PENDING_SCAN") return false;
      await tx.kycDocument.delete({ where: { id: doc.id } });
      await appendAuditEvent(tx, {
        actorId: input.userId,
        action: "KYC_DOCUMENT_CANCELLED",
        entityType: "KycDocument",
        entityId: doc.id,
        metadata: { key: doc.storageKey },
      });
      return doc;
    }, { isolationLevel: "Serializable" })
    .then(async (doc) => {
      if (doc) {
        await deleteObject({ key: doc.storageKey, bucket: doc.bucket }).catch(() => undefined);
        return true;
      }
      return false;
    });
}

export interface AdminDocumentView extends PublicDocument {
  userId: string;
}

export async function listDocumentsForSubmission(submissionId: string): Promise<AdminDocumentView[]> {
  const rows = await prisma.kycDocument.findMany({
    where: { kycSubmissionId: submissionId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    docType: row.docType,
    status: row.status,
    version: row.version,
    sha256: row.sha256 === "pending" ? "" : row.sha256,
    sizeBytes: row.sizeBytes,
    detectedMime: row.detectedMime,
    declaredMime: row.declaredMime,
    uploadedAt: row.uploadedAt,
    finalizedAt: row.finalizedAt,
  }));
}

/**
 * Retention hook: tombstone (soft-delete) documents whose approved submission is
 * older than the retention window, and delete their backing sealed object. Not
 * auto-run; intended to be invoked by a scheduled job.
 */
export async function applyRetention(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays() * 86_400_000);
  const expired = await prisma.kycDocument.findMany({
    where: { deletedAt: null, status: "CLEAN", kycSubmission: { reviewedAt: { lt: cutoff } } },
    select: { id: true, storageKey: true },
    take: 500,
  });
  if (expired.length === 0) return 0;
  await prisma.$transaction(async (tx) => {
    await tx.kycDocument.updateMany({
      where: { id: { in: expired.map((d) => d.id) } },
      data: { deletedAt: now },
    });
    await appendAuditEvent(tx, {
      action: "KYC_DOCUMENT_RETENTION_APPLIED",
      entityType: "KycDocument",
      metadata: { count: expired.length, cutoff: cutoff.toISOString() },
    });
  }, { isolationLevel: "Serializable" });
  await Promise.all(
    expired.map((d) => deleteObject({ key: d.storageKey, bucket: sealedBucket() }).catch(() => undefined)),
  );
  return expired.length;
}
