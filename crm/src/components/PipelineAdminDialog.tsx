"use client";

import { useState } from "react";
import type { Pipeline } from "@/components/OpportunitiesPage";
import { useConfirmDialog } from "@/components/Dialogs";
import { Modal } from "@/components/Modal";
import { FormError, IconInput, IconSelectTrigger } from "@/components/form";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export function PipelineAdmin({
  pipelines,
  onChanged,
  onClose,
}: {
  pipelines: Pipeline[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [pipelineName, setPipelineName] = useState("");
  const [stageDraft, setStageDraft] = useState<Record<string, { name: string; type: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  async function call(input: RequestInfo, init: RequestInit) {
    const response = await fetch(input, init);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Action failed.");
      return false;
    }
    setError(null);
    onChanged();
    return true;
  }

  return (
    <>
      <Modal title="Manage pipelines" onClose={onClose} size="lg">
        <div className="space-y-4">
          <div><p className="form-section-title">Pipelines & stages</p><p className="form-section-help">Add stages to each pipeline, or create a new pipeline at the bottom.</p></div>
          <FormError message={error} />

          {pipelines.map((pipeline) => (
            <Card key={pipeline.id} className="gap-0 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {pipeline.name}
                  {pipeline.isDefault ? " ★ default" : ""}
                </p>
                <div className="flex gap-2 text-xs">
                  {!pipeline.isDefault ? (
                    <button
                      type="button"
                      onClick={() => void call(`/api/pipelines/${pipeline.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isDefault: true }),
                      })}
                      className="text-(--brand) hover:underline"
                    >
                      Make default
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete pipeline “${pipeline.name}”?`,
                        message: "The pipeline and all of its stages will be removed. Opportunities referencing its stages may become invalid.",
                        confirmLabel: "Delete pipeline",
                        destructive: true,
                      });
                      if (ok) {
                        void call(`/api/pipelines/${pipeline.id}`, { method: "DELETE" });
                      }
                    }}
                    className="text-(--error) hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <ul className="mb-2 space-y-1">
                {pipeline.stages.map((stage) => (
                  <li key={stage.id} className="flex items-center justify-between text-sm">
                    <span>
                      {stage.name}{" "}
                      <span className="text-xs text-(--text-tertiary)">
                        {stage.probability}% · {stage.type.toLowerCase()}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete stage “${stage.name}”?`,
                          message: "The stage will be removed from this pipeline.",
                          confirmLabel: "Delete stage",
                          destructive: true,
                        });
                        if (ok) {
                          void call(`/api/pipelines/${pipeline.id}/stages/${stage.id}`, { method: "DELETE" });
                        }
                      }}
                      className="text-xs text-(--error) hover:underline"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="flex items-center gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const draft = stageDraft[pipeline.id];
                  if (!draft?.name) return;
                  const ok = await call(`/api/pipelines/${pipeline.id}/stages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: draft.name, type: draft.type ?? "OPEN", probability: 50 }),
                  });
                  if (ok) setStageDraft((prev) => ({ ...prev, [pipeline.id]: { name: "", type: "OPEN" } }));
                }}
              >
                <div className="flex-1">
                  <IconInput
                    aria-label={`New stage for ${pipeline.name}`}
                    icon="tag"
                    placeholder="e.g. Negotiation"
                    value={stageDraft[pipeline.id]?.name ?? ""}
                    onChange={(event) =>
                      setStageDraft((prev) => ({
                        ...prev,
                        [pipeline.id]: { name: event.target.value, type: prev[pipeline.id]?.type ?? "OPEN" },
                      }))
                    }
                  />
                </div>
                <Select
                  value={stageDraft[pipeline.id]?.type ?? "OPEN"}
                  onValueChange={(value) =>
                    setStageDraft((prev) => ({
                      ...prev,
                      [pipeline.id]: { name: prev[pipeline.id]?.name ?? "", type: value },
                    }))
                  }
                >
                  <IconSelectTrigger aria-label="Stage type" icon="tag" wrapperClassName="w-24">
                    <SelectValue />
                  </IconSelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="WON">Won</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" variant="secondary" size="sm" icon="plus">
                  Add stage
                </Button>
              </form>
            </Card>
          ))}

          <form
            className="flex items-center gap-2 border-t border-(--border-default) pt-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!pipelineName) return;
              const ok = await call("/api/pipelines", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: pipelineName }),
              });
              if (ok) setPipelineName("");
            }}
          >
            <div className="flex-1">
              <IconInput
                aria-label="New pipeline name"
                icon="tag"
                placeholder="e.g. Enterprise deals"
                value={pipelineName}
                onChange={(event) => setPipelineName(event.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" icon="plus">
              Add pipeline
            </Button>
          </form>

          <div className="form-actions">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {confirmDialog}
    </>
  );
}
