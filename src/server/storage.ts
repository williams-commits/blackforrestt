import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

/**
 * Private S3-compatible storage for KYC documents.
 *
 * Objects live in one of two buckets:
 *   - quarantine: uploaded through the app server (same-origin), not yet verified
 *   - sealed:     server-verified, SSE-enforced, compliance read-only
 *
 * Uploads and downloads are proxied through the application so the browser only
 * ever talks to the app origin — there are no cross-origin requests to object
 * storage, so no provider bucket-CORS configuration is required. Encryption is
 * provider-side SSE, applied by the server on every write (SSE-KMS when
 * KYC_KMS_KEY_ID is set, otherwise AES256). The app never stores object bytes in
 * PostgreSQL — only an opaque storage key and metadata.
 */

type S3ClientT = InstanceType<typeof S3Client>;

let client: S3ClientT | null = null;

function bucketPrefix(): string {
  return process.env.S3_BUCKET_PREFIX?.trim() || "blckforest-kyc";
}

export function quarantineBucket(): string {
  return `${bucketPrefix()}-quarantine`;
}

export function sealedBucket(): string {
  return `${bucketPrefix()}-sealed`;
}

/** Private object buckets used for manual payment proofs. */
export function paymentProofQuarantineBucket(): string {
  return `${bucketPrefix()}-payment-quarantine`;
}

export function paymentProofSealedBucket(): string {
  return `${bucketPrefix()}-payment-sealed`;
}

/** Every bucket the application reads or writes. Kept in sync with the
 *  minio-init container in deploy/docker-compose.prod.yml. */
function requiredBuckets(): string[] {
  return [quarantineBucket(), sealedBucket(), paymentProofQuarantineBucket(), paymentProofSealedBucket()];
}

const BUCKET_EXISTS_ERRORS = new Set(["BucketAlreadyOwnedByYou", "BucketAlreadyExists"]);

/**
 * Idempotently create every bucket the app needs under the configured prefix.
 *
 * The deploy stack creates these via a one-shot `minio-init` container — but
 * that only runs when the container is (re)created. If the prefix changed, or
 * buckets were added after the stack first came up (e.g. the payment-proof
 * buckets), the app would otherwise 503 on every upload until someone runs
 * bootstrap commands by hand. Creating them here makes the application
 * self-sufficient; "already exists" outcomes are treated as success so this is
 * safe to run on every boot and before every retry.
 *
 * Returns the buckets it actually created (empty when all existed).
 */
export async function ensureStorageBuckets(): Promise<string[]> {
  const s3 = getStorage();
  const created: string[] = [];
  for (const bucket of requiredBuckets()) {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      created.push(bucket);
    } catch (error) {
      const name = (error as { name?: string; Code?: string })?.name ?? (error as { Code?: string })?.Code ?? "";
      if (BUCKET_EXISTS_ERRORS.has(name)) continue;
      throw error;
    }
  }
  return created;
}

function isNoSuchBucketError(error: unknown): boolean {
  const name = (error as { name?: string; Code?: string })?.name ?? (error as { Code?: string })?.Code ?? "";
  return name === "NoSuchBucket";
}

/** Run a put, and if the target bucket is missing (fresh prefix, init container
 *  never ran for it), create the buckets once and retry — uploads then succeed
 *  instead of returning "temporarily unavailable" forever. */
async function putWithBucketEnsure(put: () => Promise<void>): Promise<void> {
  try {
    await put();
  } catch (error) {
    if (!isNoSuchBucketError(error)) throw error;
    await ensureStorageBuckets();
    await put();
  }
}

export function getStorage(): S3ClientT {
  if (client) return client;
  const endpoint = process.env.S3_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error("S3_ENDPOINT is required for private document storage.");
  }
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required.");
  }
  const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() === "true";
  client = new S3Client({
    region: process.env.S3_REGION?.trim() || "us-east-1",
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export async function closeStorage(): Promise<void> {
  const current = client;
  client = null;
  if (current) await current.destroy();
}

/**
 * SSE parameters applied to server-side object writes. When a KMS key is
 * configured the per-request SSE-KMS header is sent; otherwise encryption is
 * enforced by the bucket default-encryption policy (SSE-S3/AES256) configured at
 * init, and no per-request header is sent — some providers (including MinIO
 * without KMS) reject the AES256 header entirely, while still honouring bucket
 * default encryption.
 */
function sseParams(): Record<string, string> {
  const kms = process.env.KYC_KMS_KEY_ID?.trim();
  if (kms) return { ServerSideEncryption: "aws:kms", SSEKMSKeyId: kms };
  return {};
}

export interface ObjectHead {
  sizeBytes: number;
  etag: string | undefined;
  contentType: string | undefined;
}

/** Read authoritative object metadata (size/content-type) from the provider. */
export async function headObject(input: {
  key: string;
  bucket: string;
}): Promise<ObjectHead> {
  const s3 = getStorage();
  const out = await s3.send(
    new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }),
  );
  return {
    sizeBytes: out.ContentLength ?? 0,
    etag: out.ETag?.replace(/"/g, ""),
    contentType: out.ContentType,
  };
}

/**
 * Write uploaded bytes to the quarantine bucket server-side. The app receives
 * the document body from the browser (same-origin) and streams it straight to
 * storage with SSE applied; no bytes are persisted in PostgreSQL.
 */
export async function putQuarantineObject(input: {
  key: string;
  contentType: string;
  bytes: Buffer;
}): Promise<void> {
  const s3 = getStorage();
  await putWithBucketEnsure(() =>
    s3.send(
      new PutObjectCommand({
        Bucket: quarantineBucket(),
        Key: input.key,
        ContentType: input.contentType,
        Body: input.bytes,
        ...sseParams(),
      }),
    ).then(() => undefined),
  );
}

/** Write a manual-payment proof to its private quarantine bucket. */
export async function putPaymentProofQuarantineObject(input: {
  key: string;
  contentType: string;
  bytes: Buffer;
}): Promise<void> {
  const s3 = getStorage();
  await putWithBucketEnsure(() =>
    s3.send(
      new PutObjectCommand({
        Bucket: paymentProofQuarantineBucket(),
        Key: input.key,
        ContentType: input.contentType,
        Body: input.bytes,
        ...sseParams(),
      }),
    ).then(() => undefined),
  );
}

/** Stream an object's body as a Node Buffer (used for hashing/scan/download). */
export async function readObjectBuffer(input: {
  key: string;
  bucket: string;
}): Promise<Buffer> {
  const s3 = getStorage();
  const out = await s3.send(
    new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
  );
  const body = out.Body as AsyncIterable<Buffer> | undefined;
  if (!body) throw new Error("Storage object body is empty.");
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Copy a verified quarantine object into the sealed bucket without deleting the
 * source. Callers update PostgreSQL first, then remove the quarantine copy.
 * This ordering makes finalization retry-safe: if the database transaction
 * fails after the copy, the authoritative row still points at quarantine and a
 * retry can safely repeat the same copy operation.
 */
export async function copyToSealed(input: {
  key: string;
}): Promise<{ key: string; bucket: string }> {
  const s3 = getStorage();
  const sealed = sealedBucket();
  await s3.send(
    new CopyObjectCommand({
      Bucket: sealed,
      Key: input.key,
      CopySource: `${quarantineBucket()}/${input.key}`,
      MetadataDirective: "COPY",
      ...sseParams(),
    }),
  );
  return { key: input.key, bucket: sealed };
}

/** Copy a verified payment proof into its sealed bucket without deleting source. */
export async function copyPaymentProofToSealed(input: {
  key: string;
}): Promise<{ key: string; bucket: string }> {
  const s3 = getStorage();
  const sealed = paymentProofSealedBucket();
  await s3.send(
    new CopyObjectCommand({
      Bucket: sealed,
      Key: input.key,
      CopySource: `${paymentProofQuarantineBucket()}/${input.key}`,
      MetadataDirective: "COPY",
      ...sseParams(),
    }),
  );
  return { key: input.key, bucket: sealed };
}

export async function deleteObject(input: {
  key: string;
  bucket: string;
}): Promise<void> {
  const s3 = getStorage();
  await s3.send(new DeleteObjectCommand({ Bucket: input.bucket, Key: input.key }));
}
