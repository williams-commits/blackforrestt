"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OpportunityForm } from "@/components/OpportunityFormDialog";
import { useConfirmDialog } from "@/components/Dialogs";
import type { Pipeline } from "@/components/OpportunitiesPage";

/** Edit + delete controls for the opportunity detail page. */
export function OpportunityDetailActions({
  row,
  canEdit,
  canDelete,
}: {
  row: Record<string, unknown>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const pipelineId = (row.pipeline as { id?: string } | null)?.id;
  useEffect(() => {
    if (!editing || !pipelineId) return;
    void fetch("/api/pipelines")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const found = (body?.data as Pipeline[] | undefined)?.find((p) => p.id === pipelineId) ?? null;
        setPipeline(found);
      })
      .catch(() => setPipeline(null));
  }, [editing, pipelineId]);

  if (!canEdit && !canDelete) return null;

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this opportunity?",
      message: "The opportunity will be soft-deleted and removed from the pipeline board.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/opportunities/${(row as { id: string }).id}`, {
        method: "DELETE",
      });
      if (response.ok) router.push("/opportunities");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:ring-offset-2 cursor-pointer"
        >
          Edit
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className="rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:ring-offset-2 cursor-pointer"
        >
          Delete
        </button>
      ) : null}
      {editing && pipeline ? (
        <OpportunityForm
          pipeline={pipeline}
          initial={row as never}
          canEditFields
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}

      {confirmDialog}
    </div>
  );
}
