"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

interface AttachedTag {
  tagId: string;
  name: string;
  color: string | null;
}

/** Attach/detach existing tags on a record (creating tags lives in admin). */
export function TagEditor({
  subjectType,
  subjectId,
  attached,
  canEdit,
}: {
  subjectType: SubjectType;
  subjectId: string;
  attached: AttachedTag[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [allTags, setAllTags] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const attachedIds = new Set(attached.map((tag) => tag.tagId));

  useEffect(() => {
    void fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setAllTags(body?.data ?? []))
      .catch(() => setAllTags([]));
  }, []);

  async function link(tagId: string) {
    setBusy(true);
    try {
      await fetch("/api/tags/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, subjectType, subjectId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unlink(tagId: string) {
    setBusy(true);
    try {
      await fetch("/api/tags/link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, subjectType, subjectId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const available = allTags.filter((tag) => !attachedIds.has(tag.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {attached.length === 0 ? (
          <span className="text-sm text-[var(--text-tertiary)]">No tags.</span>
        ) : (
          attached.map((tag) => (
            <span
              key={tag.tagId}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ background: tag.color ?? "#78716c" }}
            >
              {tag.name}
              {canEdit ? (
                <button
                  type="button"
                  aria-label={`Remove tag ${tag.name}`}
                  onClick={() => void unlink(tag.tagId)}
                  disabled={busy}
                  className="ml-0.5 opacity-80 hover:opacity-100"
                >
                  ×
                </button>
              ) : null}
            </span>
          ))
        )}
      </div>
      {canEdit && available.length > 0 ? (
        <select
          aria-label="Add tag"
          defaultValue=""
          disabled={busy}
          onChange={(event) => {
            if (event.target.value) void link(event.target.value);
          }}
          className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs"
        >
          <option value="">Add tag…</option>
          {available.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
