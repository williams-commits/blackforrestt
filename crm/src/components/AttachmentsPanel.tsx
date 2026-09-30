"use client";

import { toast } from "sonner";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageAttachment } from "@/components/ImageAttachment";
import { useConfirmDialog } from "@/components/Dialogs";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { FileInput } from "@/components/form";
import { relativeTime, absoluteTime } from "@/lib/time";

interface AttachmentRow {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploader: string;
  createdAt: string;
}

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

/** Human file size — KB/MB rather than raw bytes. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Attachments on a record: upload (typed/size-limited), list, download, delete. */
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
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<File | null>(null);
  const [name, setName] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/attachments?subjectType=${subjectType}&subjectId=${subjectId}`,
    );
    if (response.ok) setRows((await response.json()).data);
  }, [subjectType, subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File, displayName?: string) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("subjectType", subjectType);
      form.set("subjectId", subjectId);
      if (displayName?.trim()) form.set("name", displayName.trim());
      const response = await fetch("/api/attachments", { method: "POST", body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Upload failed.");
        return;
      }
      setStaged(null);
      setName("");
      toast.success("File attached", { description: `${displayName?.trim() || file.name} is available on this record.` });
      void load();
      router.refresh();
    } finally {
      setBusy(false);
    }
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
      toast.success("Attachment deleted");
      void load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p>
      ) : null}
      {rows.length === 0 && !staged ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
          <Icon name="folder" size={14} className="shrink-0 text-muted-foreground/60" />
          No files yet — attach contracts, IDs, screenshots, or anything the team needs.
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="group/file flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 shadow-xs transition-colors hover:border-border/80 hover:bg-muted/30">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden>
                <Icon name={row.mimeType.startsWith("image/") ? "grid" : "file"} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <ImageAttachment
                  filename={row.filename}
                  mimeType={row.mimeType}
                  attachmentId={row.id}
                />
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {row.mimeType.startsWith("image/") ? "Image" : "File"} · {formatSize(row.size)} · {row.uploader} ·{" "}
                  <time dateTime={row.createdAt} title={absoluteTime(row.createdAt)}>{relativeTime(row.createdAt)}</time>
                </span>
              </span>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => void remove(row.id)}
                  aria-label={`Delete ${row.filename}`}
                  className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-destructive md:opacity-0 md:focus-visible:opacity-100 md:group-hover/file:opacity-100"
                >
                  <Icon name="trash" size={12} />
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canUpload ? (
        staged ? (
          <form
            className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (staged && !busy) void upload(staged, name);
            }}
          >
            <p className="form-section-title">Attach file</p>
            <p className="form-section-help">
              Give it a recognizable name — this is what the team will see. The original extension is kept.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={staged.name.replace(/\.[^.]+$/, "") || "e.g. Signed contract"}
                aria-label="File name"
                maxLength={120}
                className="h-8 min-w-48 flex-1"
                autoFocus
              />
              <span className="text-xs text-muted-foreground">
                {staged.name} · {formatSize(staged.size)}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => { setStaged(null); setName(""); }}>Cancel</Button>
              <Button type="submit" variant="primary" icon="upload" loading={busy}>Upload</Button>
            </div>
          </form>
        ) : (
          <FileInput
            icon="upload"
            aria-label="Attach file"
            className="max-w-64 cursor-pointer"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setStaged(file);
                setName(file.name.replace(/\.[^.]+$/, ""));
              }
              event.target.value = "";
            }}
          />
        )
      ) : null}

      {confirmDialog}
    </div>
  );
}
