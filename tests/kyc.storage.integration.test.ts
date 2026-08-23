import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  cancelUpload,
  complianceDownload,
  finalizeUpload,
  listDocuments,
  receiveUpload,
} from "../src/server/security/kycDocuments.js";
import { closeStorage, sealedBucket, deleteObject } from "../src/server/storage.js";

const prisma = new PrismaClient();

// Test fixtures: valid PNG (8-byte signature + IHDR), valid PDF header, EICAR file.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_FIXTURE = Buffer.concat([PNG_SIGNATURE, Buffer.from("IHDR test image body")]);
// EICAR signature embedded inside a valid-looking PDF so it passes magic-byte
// verification, exercising the scan-after-verify path (the scanner catches it).
const EICAR_FIXTURE = Buffer.concat([
  Buffer.from("%PDF-1.4\n"),
  Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*", "latin1"),
  Buffer.alloc(16, 0x41),
]);

async function setupUserAndSubmission(suffix: string) {
  const user = await prisma.user.create({
    data: {
      email: `kyc-${suffix}@example.invalid`,
      accountNo: suffix.replaceAll("-", "").slice(0, 12),
      emailVerifiedAt: new Date(),
    },
  });
  const submission = await prisma.kycSubmission.create({
    data: { userId: user.id, status: "PENDING", firstName: "Test", lastName: "User" },
  });
  return { user, submission };
}

test("receive -> finalize produces a CLEAN sealed document with correct hash", async () => {
  const suffix = randomUUID();
  const { user, submission } = await setupUserAndSubmission(suffix);

  const upload = await receiveUpload({
    userId: user.id,
    kycSubmissionId: submission.id,
    docType: "PASSPORT",
    bytes: PNG_FIXTURE,
  });

  const outcome = await finalizeUpload({ documentId: upload.documentId, userId: user.id });
  assert.equal(outcome.kind, "ok");
  if (outcome.kind !== "ok") return;
  assert.equal(outcome.result.status, "CLEAN");
  assert.equal(outcome.result.detectedMime, "image/png");
  assert.equal(outcome.result.sizeBytes, PNG_FIXTURE.length);
  const expectedHash = createHash("sha256").update(PNG_FIXTURE).digest("hex");
  assert.equal(outcome.result.sha256, expectedHash);

  // Object must have moved quarantine -> sealed.
  const doc = await prisma.kycDocument.findUniqueOrThrow({ where: { id: upload.documentId } });
  assert.equal(doc.bucket, sealedBucket());
  assert.equal(doc.status, "CLEAN");

  // No plaintext bytes or raw URL leak via the public listing.
  const docs = await listDocuments(user.id);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].sha256, expectedHash);
});

test("EICAR bytes finalize to BLOCKED and never reach the sealed bucket", async () => {
  const suffix = randomUUID();
  const { user, submission } = await setupUserAndSubmission(suffix);

  const upload = await receiveUpload({
    userId: user.id,
    kycSubmissionId: submission.id,
    docType: "ID_CARD",
    bytes: EICAR_FIXTURE,
  });

  const outcome = await finalizeUpload({ documentId: upload.documentId, userId: user.id });
  assert.equal(outcome.kind, "ok");
  if (outcome.kind !== "ok") return;
  assert.equal(outcome.result.status, "BLOCKED");

  const doc = await prisma.kycDocument.findUniqueOrThrow({ where: { id: upload.documentId } });
  assert.equal(doc.status, "BLOCKED");
  assert.notEqual(doc.bucket, sealedBucket());
  assert.ok(doc.finalizedAt);

  // An audit event for the block must exist.
  const audit = await prisma.auditEvent.findFirst({
    where: { entityId: upload.documentId, action: "KYC_DOCUMENT_BLOCKED" },
  });
  assert.ok(audit);
});

test("content that is not JPEG/PNG/PDF is rejected at receive time", async () => {
  const suffix = randomUUID();
  const { user, submission } = await setupUserAndSubmission(suffix);

  // The document type is resolved from magic bytes, so unrecognized content is
  // rejected immediately — whatever the browser declared about it.
  await assert.rejects(
    receiveUpload({
      userId: user.id,
      kycSubmissionId: submission.id,
      docType: "DRIVING_LICENSE",
      bytes: Buffer.alloc(64, 0x43),
    }),
    /Only JPEG, PNG, and PDF/,
  );
  const docs = await listDocuments(user.id);
  assert.equal(docs.length, 0);
});

test("complianceDownload returns sealed bytes only for CLEAN documents and logs access", async () => {
  const suffix = randomUUID();
  const { user, submission } = await setupUserAndSubmission(suffix);
  const adminSuffix = randomUUID();
  const admin = await prisma.user.create({
    data: {
      email: `kycadmin-${adminSuffix}@example.invalid`,
      accountNo: adminSuffix.replaceAll("-", "").slice(0, 12),
      isAdmin: true,
      emailVerifiedAt: new Date(),
    },
  });

  const upload = await receiveUpload({
    userId: user.id,
    kycSubmissionId: submission.id,
    docType: "PASSPORT",
    bytes: PNG_FIXTURE,
  });
  await finalizeUpload({ documentId: upload.documentId, userId: user.id });

  const access = await complianceDownload({
    documentId: upload.documentId,
    actorId: admin.id,
    reason: "Compliance review of passport for account opening",
    networkAddress: "198.51.100.7",
  });
  assert.ok(access, "expected sealed bytes for a CLEAN document");
  assert.equal(access!.contentType, "image/png");
  // The streamed bytes must equal the original fixture exactly.
  assert.ok(access!.bytes.equals(PNG_FIXTURE));

  // The access row records who/why.
  const accessRow = await prisma.kycDocumentAccess.findFirstOrThrow({
    where: { documentId: upload.documentId },
  });
  assert.equal(accessRow.actorId, admin.id);
  assert.ok(accessRow.reason.includes("Compliance review"));

  // An unknown / non-CLEAN document returns null.
  const blocked = await complianceDownload({
    documentId: randomUUID(),
    actorId: admin.id,
    reason: "should not resolve",
  });
  assert.equal(blocked, null);
});

test("a CLEAN document cannot be re-finalized or cancelled (immutability)", async () => {
  const suffix = randomUUID();
  const { user, submission } = await setupUserAndSubmission(suffix);

  const upload = await receiveUpload({
    userId: user.id,
    kycSubmissionId: submission.id,
    docType: "PASSPORT",
    bytes: PNG_FIXTURE,
  });
  await finalizeUpload({ documentId: upload.documentId, userId: user.id });

  // Re-finalizing a CLEAN document is a conflict, not a mutation.
  const again = await finalizeUpload({ documentId: upload.documentId, userId: user.id });
  assert.equal(again.kind, "conflict");

  // A CLEAN document cannot be cancelled (only PENDING_SCAN can).
  const cancelled = await cancelUpload({ documentId: upload.documentId, userId: user.id });
  assert.equal(cancelled, false);
});

test("API responses and listings never expose raw storage bytes or object URLs", async () => {
  const suffix = randomUUID();
  const { user, submission } = await setupUserAndSubmission(suffix);

  const upload = await receiveUpload({
    userId: user.id,
    kycSubmissionId: submission.id,
    docType: "PROOF_OF_ADDRESS",
    bytes: PNG_FIXTURE,
  });
  await finalizeUpload({ documentId: upload.documentId, userId: user.id });

  const docs = await listDocuments(user.id);
  const serialized = JSON.stringify(docs);
  // Only an opaque key/hash/metadata; never a presigned URL or bytes.
  assert.ok(!serialized.includes("X-Amz-Signature"));
  assert.ok(!serialized.includes("uploadUrl"));
  assert.ok(!serialized.includes(PNG_FIXTURE.toString("latin1").slice(0, 8)));
  assert.ok(docs[0].sha256.length === 64);
});

test.after(async () => {
  // Best-effort cleanup of test objects so the buckets stay empty between runs.
  const docs = await prisma.kycDocument.findMany({ where: { sha256: { not: "pending" } }, select: { storageKey: true, bucket: true } });
  await Promise.all(docs.map((d) => deleteObject({ key: d.storageKey, bucket: d.bucket }).catch(() => undefined)));
  await closeStorage();
  await prisma.$disconnect();
});
