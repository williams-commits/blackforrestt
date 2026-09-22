"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSelectTrigger } from "@/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

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
}: {
  subjectType: SubjectType;
  subjectId: string;
  attached: AttachedTag[];
}) {
  const router = useRouter();
  const [allTags, setAllTags] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [canManageTags, setCanManageTags] = useState(false);
  const attachedIds = new Set(attached.map((tag) => tag.tagId));

  useEffect(() => {
    void fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setAllTags(body?.data ?? []))
      .catch(() => setAllTags([]));
  }, [subjectType]);
  useEffect(() => {
    void fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const permissions = body?.data?.permissions ?? [];
        const subjectPermission = {
          LEAD: "LEADS_MANAGE_TAGS",
          CONTACT: "CONTACTS_MANAGE_TAGS",
          ACCOUNT: "ACCOUNTS_MANAGE_TAGS",
          CUSTOMER: "CUSTOMERS_MANAGE_TAGS",
          OPPORTUNITY: "OPPORTUNITIES_MANAGE_TAGS",
        }[subjectType];
        setCanManageTags(permissions.includes(subjectPermission));
      })
      .catch(() => setCanManageTags(false));
  }, [subjectType]);

  const canManage = canManageTags;

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
          <span className="text-sm text-(--text-tertiary)">No tags.</span>
        ) : (
          attached.map((tag) => (
            <span
              key={tag.tagId}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ background: tag.color ?? "var(--gray-500)" }}
            >
              {tag.name}
              {canManage ? (
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
      {canManage && available.length > 0 ? (
        <Select
          defaultValue="__none__"
          disabled={busy}
          onValueChange={(value) => {
            if (value !== "__none__") void link(value);
          }}
        >
          <IconSelectTrigger icon="tag" size="sm" aria-label="Add tag" className="w-auto gap-1 text-xs">
            <SelectValue />
          </IconSelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="__none__">Add tag…</SelectItem>
            {available.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
