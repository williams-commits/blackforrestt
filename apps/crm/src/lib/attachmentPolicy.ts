/**
 * Attachment policy — one source of truth shared by the upload API route
 * (enforcement) and the client uploader (pre-validation + helper text).
 * No server imports here: this module must stay client-safe.
 */

export const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/** Uploadable MIME types. HEIC/HEIF keep iPhone photos working (the most
 *  common "upload failed" report); AVIF/GIF round out camera formats;
 *  SVG/ZIP/PPTX cover the everyday document set. SVG is never served
 *  inline (see the download route) — it only previews inside <img> tiles. */
export const ATTACHMENT_ALLOWED_TYPES = [
  // Documents
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Images (incl. camera originals)
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/svg+xml",
  // Archives teams attach to records
  "application/zip",
] as const;

/** Raster types the download route may serve inline (never SVG — scripts). */
export const INLINE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as const;

/** Client-side pre-validation — mirrors the server's checks so obvious
 *  problems surface instantly per file instead of as a failed POST. */
export function attachmentRejection(file: { name: string; type: string; size: number }): string | null {
  if (file.size > ATTACHMENT_MAX_SIZE) {
    return `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is 10 MB.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type as never)) {
    // The browser couldn't identify it, or it's genuinely unsupported.
    return `${file.name}: ${file.type || "unknown"} files aren't supported.`;
  }
  return null;
}

/** Human file size — KB/MB rather than raw bytes. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
