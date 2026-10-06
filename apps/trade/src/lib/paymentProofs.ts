/** Shared upload policy for manual payment proofs (server + client). */
export const PAYMENT_PROOF_MAX_BYTES = 1_048_576;

// ── Browser-side preparation helpers (no-ops on the server) ──────────────────
// Phone photos are routinely 2–8 MB and iPhone cameras produce HEIC, neither
// of which survives the 1 MB / JPEG-PNG-PDF proof policy. These helpers run at
// file selection so users don't lose the upload at the last step.

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);

/** True for iPhone HEIC/HEIF photos — not in the accepted types, and the
 *  server's magic-byte check would reject them after a wasted upload. */
export async function isHeicFile(file: File): Promise<boolean> {
  try {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isFtyp = [0x66, 0x74, 0x79, 0x70].every((byte, index) => header[4 + index] === byte);
    if (!isFtyp) return false;
    const brand = String.fromCharCode(...header.slice(8, 12)).toLowerCase();
    return HEIC_BRANDS.has(brand);
  } catch {
    return false;
  }
}

const PROOF_IMAGE_MAX_EDGE = 2400;

/** Downscale and re-encode an oversized JPEG/PNG through a canvas so the proof
 *  fits the size cap. Returns the original file untouched when it already
 *  fits, is not a decodable image, or compression cannot get under the cap —
 *  the caller's size error then explains what to do (e.g. PDFs). */
export async function compressProofImage(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes) return file;
  if (file.type !== "image/jpeg" && file.type !== "image/png") return file;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const targetBytes = Math.floor(maxBytes * 0.95);
      let edge = Math.min(PROOF_IMAGE_MAX_EDGE, Math.max(bitmap.width, bitmap.height));
      for (let attempt = 0; attempt < 4; attempt++) {
        const scale = edge / Math.max(bitmap.width, bitmap.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return file;
        // JPEG has no alpha channel — paint a white background so transparent
        // PNG screenshots don't turn black.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const quality = 0.85 - attempt * 0.15;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= targetBytes) {
          const name = file.name.replace(/\.[^.]*$/, "") || "payment-proof";
          return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
        }
        edge = Math.floor(edge * 0.7);
      }
      return file;
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
