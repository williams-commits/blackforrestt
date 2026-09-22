"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageAttachment } from "@/components/ImageAttachment";
import { useConfirmDialog } from "@/components/Dialogs";
import { Icon } from "@/components/Icon";
import { FileInput } from "@/components/form";

interface AttachmentRow {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploader: string;
  createdAt: string;
}

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

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

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("subjectType", subjectType);
      form.set("subjectId", subjectId);
      const response = await fetch("/api/attachments", { method: "POST", body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Upload failed.");
        return;
      }
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
      await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
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
      {rows.length === 0 ? (
        <p className="text-sm text-(--text-tertiary)">No attachments.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between divider-y rounded-md bg-muted p-2">
              <ImageAttachment
                filename={row.filename}
                mimeType={row.mimeType}
                attachmentId={row.id}
              />
              <span className="flex items-center gap-2 text-xs text-(--text-tertiary)">
                {(row.size / 1024).toFixed(0)} KB · {row.uploader} · {new Date(row.createdAt).toLocaleDateString()}
                {canDelete ? (
                  <button type="button" onClick={() => void remove(row.id)} className="flex intems-center gap-1 text-(--error) hover:underline">
                    <Icon name="trash" size={12} />
                    delete
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload ? (
        <FileInput
          icon="upload"
          aria-label="Attach file"
          className="max-w-64 cursor-pointer"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      ) : null}

      {confirmDialog}
    </div>
  );
}
