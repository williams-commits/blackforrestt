"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageAttachment } from "@/components/ImageAttachment";

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
    if (!window.confirm("Delete this attachment?")) return;
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
        <p role="alert" className="rounded-md bg-[--error-bg] px-3 py-2 text-sm text-[--error]">{error}</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-[--text-tertiary)]">No attachments.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between text-sm">
              <ImageAttachment
                filename={row.filename}
                mimeType={row.mimeType}
                attachmentId={row.id}
              />
              <span className="flex items-center gap-2 text-xs text-[--text-tertiary]">
                {(row.size / 1024).toFixed(0)} KB · {row.uploader} · {new Date(row.createdAt).toLocaleDateString()}
                {canDelete ? (
                  <button type="button" onClick={() => void remove(row.id)} className="text-[--error] hover:underline">
                    delete
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload ? (
        <label
          className={`inline-block cursor-pointer rounded-md border border-[--border-strong] px-3 py-1.5 text-sm font-medium hover:bg-[--bg-hover] ${busy ? "opacity-50" : ""}`}
        >
          {busy ? "Uploading…" : "Attach file…"}
          <input
            type="file"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
