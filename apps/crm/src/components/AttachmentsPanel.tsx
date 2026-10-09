"use client";

import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/Dialogs";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/utils";
import { relativeTime, absoluteTime } from "@/lib/time";
import {
  ATTACHMENT_ALLOWED_TYPES,
  attachmentRejection,
  formatFileSize,
} from "@/lib/attachmentPolicy";

interface AttachmentRow {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploader: string;
  createdAt: string;
}

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

/** Types that can render inside an <img> tile (SVG is safe there — scripts
 *  don't run in image contexts; HEIC can't decode in most browsers). */
const TILE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/svg+xml"];

/** Extension chip for non-image tiles — "PDF", "DOCX", "HEIC"… */
function extensionOf(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.slice(0, 5).toUpperCase() : "FILE";
}

interface QueuedTile {
  key: string;
  name: string;
  size: number;
}

/**
 * Record files, presented like a real folder: image thumbnails and typed
 * file cards in one responsive grid, with a multi-file dropzone above.
 * Uploads run per-file in parallel with live tiles; rejects (type/size)
 * surface instantly from the shared client-side policy.
 */
export function AttachmentsPanel({
  subjectType,
  subjectId,
  canUpload,
  canDelete,
}: {
  subjectType: SubjectType;
  subjectId: string;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<QueuedTile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  // Lightbox navigation rides the IMAGE subset of the folder (docs aren't
  // slides) — the lightbox becomes a mini carousel through them.
  const imageRows = rows.filter((row) => TILE_IMAGE_TYPES.includes(row.mimeType));
  const previewIndex = imageRows.findIndex((row) => row.id === previewId);
  const preview = previewIndex >= 0 ? imageRows[previewIndex] : null;

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setPreviewId(imageRows[(previewIndex - 1 + imageRows.length) % imageRows.length]?.id ?? null);
      if (event.key === "ArrowRight") setPreviewId(imageRows[(previewIndex + 1) % imageRows.length]?.id ?? null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, previewIndex, imageRows]);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/attachments?subjectType=${subjectType}&subjectId=${subjectId}`,
    );
    if (response.ok) setRows((await response.json()).data);
  }, [subjectType, subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadOne(file: File): Promise<boolean> {
    const form = new FormData();
    form.set("file", file);
    form.set("subjectType", subjectType);
    form.set("subjectId", subjectId);
    try {
      const response = await fetch("/api/attachments", { method: "POST", body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(`${file.name} failed`, { description: body?.error ?? "Upload failed." });
        return false;
      }
      return true;
    } catch {
      toast.error(`${file.name} failed`, { description: "Network error — try again." });
      return false;
    }
  }

  /** Multi-file entry point — every file uploads independently; one summary
   *  toast reports the outcome of the batch. */
  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const valid: File[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const reason = attachmentRejection(file);
      if (reason) rejected.push(reason);
      else valid.push(file);
    }
    // Live tiles for in-flight uploads so the folder reacts instantly.
    const tiles = valid.map((file, index) => ({ key: `${file.name}-${index}-${file.size}`, name: file.name, size: file.size }));
    setQueue((current) => [...tiles, ...current]);
    const results = await Promise.all(valid.map((file) => uploadOne(file)));
    setQueue((current) => current.filter((tile) => !tiles.some((t) => t.key === tile.key)));
    const okCount = results.filter(Boolean).length;
    if (okCount > 0) {
      const failCount = valid.length - okCount;
      toast.success(
        failCount > 0 ? `${okCount} of ${valid.length} files attached` : `${okCount} ${okCount === 1 ? "file" : "files"} attached`,
        failCount > 0 ? { description: `${failCount} failed — see the errors above.` } : undefined,
      );
      void load();
      router.refresh();
    }
    if (rejected.length > 0) {
      setError(rejected.join(" "));
    }
    setBusy(false);
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete attachment?",
      message: "The file will be permanently removed from this record.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not delete the attachment.");
        return;
      }
      setError(null);
      setPreviewId((current) => (current === id ? null : current));
      toast.success("Attachment deleted");
      void load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const totalSize = rows.reduce((sum, row) => sum + row.size, 0);

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p>
      ) : null}

      {/* ── Dropzone — click or drag; accepts many files at once ── */}
      {canUpload ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload files — drop or browse"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            dragDepth.current += 1;
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            dragDepth.current = 0;
            setDragActive(false);
            if (event.dataTransfer.files.length > 0) void handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40",
          )}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
            <Icon name={busy ? "refresh" : "upload"} size={16} className={busy ? "animate-spin" : undefined} />
          </span>
          <p className="text-sm font-medium text-foreground">
            {busy ? "Uploading…" : "Drop files here, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">
            Multiple files at once · up to 10 MB each · photos (incl. iPhone HEIC), PDF, Office, CSV, ZIP
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            accept={ATTACHMENT_ALLOWED_TYPES.join(",")}
            onChange={(event) => {
              if (event.target.files?.length) void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}

      {/* ── Folder summary ── */}
      {rows.length + queue.length > 0 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {rows.length + queue.length} {rows.length + queue.length === 1 ? "file" : "files"} · {formatFileSize(totalSize)}
          </span>
          {rows.length > 0 ? <span>Newest first</span> : null}
        </div>
      ) : null}

      {/* ── The folder: image thumbnails + typed file cards ── */}
      {rows.length === 0 && queue.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No files yet"
          description={canUpload ? "Attach contracts, IDs, screenshots — anything the team needs." : "Nothing has been attached to this record."}
          className="py-6"
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {queue.map((tile) => (
            <li key={tile.key} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center">
              <Icon name="refresh" size={16} className="animate-spin text-muted-foreground" />
              <span className="w-full truncate text-[11px] font-medium text-muted-foreground">{tile.name}</span>
              <span className="text-[10px] text-muted-foreground/70">{formatFileSize(tile.size)}</span>
            </li>
          ))}
          {rows.map((row) => {
            const isTileImage = TILE_IMAGE_TYPES.includes(row.mimeType);
            return (
              <li key={row.id} className="group/file relative">
                {isTileImage ? (
                  <button
                    type="button"
                    onClick={() => setPreviewId(row.id)}
                    className="block w-full overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Preview ${row.filename}`}
                  >
                    {/* Cookie-authenticated bytes render directly; lazy keeps
                        large folders cheap. Photos self-define their edges —
                        no tile border needed. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/attachments/${row.id}`}
                      alt={row.filename}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform duration-200 group-hover/file:scale-[1.03]"
                    />
                  </button>
                ) : (
                  <a
                    href={`/api/attachments/${row.id}`}
                    className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl bg-muted/60 p-3 text-center transition-colors hover:bg-muted"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-card text-primary" aria-hidden>
                      <Icon name="file" size={17} />
                    </span>
                    <span className="inline-flex rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                      {extensionOf(row.filename)}
                    </span>
                  </a>
                )}
                {/* Name + meta overlay for every tile */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2.5 pb-2 pt-6 opacity-0 transition-opacity group-hover/file:opacity-100">
                  <p className="truncate text-[11px] font-medium text-white">{row.filename}</p>
                  <p className="truncate text-[10px] text-white/70">
                    {formatSizeShort(row.size)} · {relativeTime(row.createdAt)}
                  </p>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => void remove(row.id)}
                    aria-label={`Delete ${row.filename}`}
                    className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md bg-black/50 text-white opacity-0 backdrop-blur transition hover:bg-destructive focus-visible:opacity-100 group-hover/file:opacity-100"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Image lightbox — a carousel through the folder's images ── */}
      {preview ? (
        <Modal
          onClose={() => setPreviewId(null)}
          title={preview.filename}
          size="xl"
        >
          <div className="space-y-3">
            <div className="relative flex items-center justify-center rounded-lg bg-black/5 p-2 dark:bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/attachments/${preview.id}`}
                alt={preview.filename}
                className="max-h-[65vh] w-auto max-w-full rounded-md object-contain"
              />
              {imageRows.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() => setPreviewId(imageRows[(previewIndex - 1 + imageRows.length) % imageRows.length].id)}
                    className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
                  >
                    <Icon name="chevron_left" size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setPreviewId(imageRows[(previewIndex + 1) % imageRows.length].id)}
                    className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
                  >
                    <Icon name="chevron_right" size={14} />
                  </button>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {imageRows.length > 1 ? `${previewIndex + 1} of ${imageRows.length} · ` : ""}
                {formatFileSize(preview.size)} · uploaded by {preview.uploader} ·{" "}
                <time dateTime={preview.createdAt} title={absoluteTime(preview.createdAt)}>{relativeTime(preview.createdAt)}</time>
              </span>
              <span className="flex gap-2">
                <a
                  href={`/api/attachments/${preview.id}`}
                  download={preview.filename}
                  className="rounded-md border border-border px-2.5 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Download
                </a>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => void remove(preview.id)}
                    className="rounded-md border border-transparent bg-destructive/10 px-2.5 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/20"
                  >
                    Delete
                  </button>
                ) : null}
              </span>
            </div>
          </div>
        </Modal>
      ) : null}

      {confirmDialog}
    </div>
  );
}

/** Compact size for tile overlays (shorter than formatFileSize). */
function formatSizeShort(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
