"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
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
  const [error, setError] = useState<string | null>(null);
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
      const response = await fetch("/api/tags/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not attach tag.");
        return;
      }
      setError(null);
      toast.success("Tag attached");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unlink(tagId: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/tags/link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, subjectType, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not remove tag.");
        return;
      }
      setError(null);
      toast.success("Tag removed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const available = allTags.filter((tag) => !attachedIds.has(tag.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {attached.length === 0 ? (
          // Ghost chip — same shape/metrics as a real tag so the row reads
          // "a tag goes here", not a floating empty-state heading.
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground/70">
            <Icon name="tag" size={11} className="shrink-0" />
            No tags yet
          </span>
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
                  className="-mr-0.5 ml-0.5 flex size-3.5 items-center justify-center rounded-full text-[11px] leading-none opacity-70 transition-opacity hover:bg-white/25 hover:opacity-100 disabled:opacity-40"
                >
                  <Icon name="close" size={10} strokeWidth={3} />
                </button>
              ) : null}
            </span>
          ))
        )}
      </div>
      {error ? <p role="alert" className="text-xs text-(--error)">{error}</p> : null}
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
