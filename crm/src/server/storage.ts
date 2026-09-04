/**
 * Object-storage abstraction for record attachments. The default adapter is
 * the local filesystem (a volume in the container); an S3/MinIO adapter can
 * be dropped in behind StorageProvider without touching callers. Keys are
 * opaque server-generated identifiers — client filenames never reach the
 * filesystem.
 */

export interface StoredObject {
  key: string;
  size: number;
}

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(process.env.ATTACHMENT_STORAGE_DIR ?? "uploads/attachments");

/** Local-disk adapter (single-container model; see DEPLOYMENT.md). */
export const localStorageProvider: StorageProvider = {
  async put(key, data) {
    const path = join(ROOT, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return { key, size: data.byteLength };
  },
  async get(key) {
    try {
      const data = await readFile(join(ROOT, key));
      return { data, contentType: "application/octet-stream" };
    } catch {
      return null;
    }
  },
  async delete(key) {
    try {
      await unlink(join(ROOT, key));
    } catch {
      // already gone — delete is idempotent
    }
  },
};

export function storage(): StorageProvider {
  return localStorageProvider;
}
