"use client";

import { useEffect, useState } from "react";
import type { Pipeline, OpportunityRow } from "@/components/OpportunitiesPage";

export function OpportunityForm({
  pipeline,
  initial,
  onClose,
  onSaved,
  canEditFields,
  canChangeStage = canEditFields,
}: {
  pipeline: Pipeline;
  initial: OpportunityRow | null;
  canEditFields: boolean;
  canChangeStage?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [stageId, setStageId] = useState(initial?.stageId ?? "");
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [accountOptions, setAccountOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [contactOptions, setContactOptions] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);

  useEffect(() => {
    void fetch("/api/accounts?pageSize=100").then((r) => (r.ok ? r.json() : null)).then((b) => setAccountOptions(b?.data ?? []));
    void fetch("/api/contacts?pageSize=100").then((r) => (r.ok ? r.json() : null)).then((b) => setContactOptions(b?.data ?? []));
  }, []);
  const [value, setValue] = useState(initial?.value ? String(Number(initial.value) / 100) : "");
  const [probability, setProbability] = useState(initial ? String(initial.probability) : "");
  const [expectedCloseAt, setExpectedCloseAt] = useState(
    initial?.expectedCloseAt ? initial.expectedCloseAt.slice(0, 10) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputClass =
    "w-full rounded-md border border-(--border-strong) px-3 py-2 text-sm focus:border-(--brand) focus:outline-none";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name,
        pipelineId: pipeline.id,
        ...(stageId ? { stageId } : {}),
        ...(accountId ? { accountId } : {}),
        ...(contactId ? { contactId } : {}),
        ...(value ? { value: Math.round(parseFloat(value) * 100) } : {}),
        ...(probability ? { probability: parseInt(probability, 10) } : {}),
        ...(expectedCloseAt ? { expectedCloseAt } : {}),
      };
      const response = await fetch(
        initial ? `/api/opportunities/${initial.id}` : "/api/opportunities",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Save failed.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" role="dialog" aria-modal="true">
      <form method="post" onSubmit={submit} className="form-dialog w-full max-w-2xl space-y-4 border border-(--border-default) bg-(--bg-surface) p-6 text-(--text-primary) shadow-xl">
        <div className="form-dialog-header"><div><p className="form-dialog-eyebrow">Revenue workspace</p><h2 className="form-dialog-title">{initial ? "Edit opportunity" : "New opportunity"}</h2><p className="form-help">Pipeline: {pipeline.name}</p></div><button type="button" onClick={onClose} className="icon-button" aria-label="Close form">×</button></div>
        {error ? (
          <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
            {error}
          </p>
        ) : null}
        <div className="form-section space-y-4">
          <div><p className="form-section-title">Deal essentials</p><p className="form-section-help">Name the opportunity and place it in the right stage.</p></div>
          <div>
          <label htmlFor="o-name" className="form-label">Name <span className="form-required">*</span></label>
          <input id="o-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} disabled={!canEditFields} className={inputClass} />
          </div>
        <div>
          <label htmlFor="o-stage" className="mb-1 block text-sm font-medium">Stage</label>
          <select id="o-stage" value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={!canChangeStage} className={inputClass}>
            <option value="">First open stage</option>
            {pipeline.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="o-account" className="form-label">Account</label>
            <select id="o-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="o-contact" className="form-label">Contact</label>
            <select id="o-contact" value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {contactOptions.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>
              ))}
            </select>
          </div>
        </div>
        </div>
        <div className="form-section grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className="form-section-title">Forecast</p><p className="form-section-help">Use value, probability, and close date to keep the forecast honest.</p></div>
          <div>
            <label htmlFor="o-value" className="form-label">Value (USD)</label>
            <input id="o-value" type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="o-prob" className="form-label">Probability %</label>
            <input id="o-prob" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="o-close" className="form-label">Expected close</label>
          <input id="o-close" type="date" value={expectedCloseAt} onChange={(e) => setExpectedCloseAt(e.target.value)} className={inputClass} />
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
