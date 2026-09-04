"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OpportunityForm, type Pipeline } from "@/components/OpportunitiesPage";

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
    if (!window.confirm("Delete this opportunity?")) return;
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
          className="btn btn-secondary"
        >
          Edit
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className="btn btn-destructive"
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
    </div>
  );
}
