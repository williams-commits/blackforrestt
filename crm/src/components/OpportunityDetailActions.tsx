"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OpportunityForm } from "@/components/OpportunityFormDialog";
import { useConfirmDialog } from "@/components/Dialogs";
import { RowActions } from "@/components/RowActions";
import type { Pipeline } from "@/components/OpportunitiesPage";

/** Edit + delete controls for the opportunity detail page. */
export function OpportunityDetailActions({
  row,
  canEdit,
  canDelete,
  canAssign = false,
  canChangeStatus = false,
}: {
  row: Record<string, unknown>;
  canEdit: boolean;
  canDelete: boolean;
  canAssign?: boolean;
  canChangeStatus?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
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

  const canOpenActionForm = canEdit || canAssign || canChangeStatus;
  if (!canOpenActionForm && !canDelete) return null;

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this opportunity?",
      message: "The opportunity will be soft-deleted and removed from the pipeline board.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    {
      const response = await fetch(`/api/opportunities/${(row as { id: string }).id}`, {
        method: "DELETE",
      });
      if (response.ok) router.push("/opportunities");
    }
  }

  const actions = [
    ...(canOpenActionForm
      ? [{ label: canEdit ? "Edit" : "Manage actions", icon: "edit", onClick: () => setEditing(true) }]
      : []),
    { label: "Related tasks", icon: "square_check", onClick: () => router.push(`/tasks?subjectType=OPPORTUNITY&subjectId=${(row as { id: string }).id}`) },
    ...(canDelete
      ? [{ label: "Delete", icon: "trash", destructive: true, onClick: () => void handleDelete() }]
      : []),
  ];

  return (
    <div className="flex items-center gap-2">
      <RowActions actions={actions} />
      {editing && pipeline ? (
        <OpportunityForm
          pipeline={pipeline}
          initial={row as never}
          canEditFields={canEdit}
          canChangeStage={canChangeStatus}
          canAssign={canAssign}
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
