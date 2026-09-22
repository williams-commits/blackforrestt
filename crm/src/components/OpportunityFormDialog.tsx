"use client";

import { useEffect, useState } from "react";
import { Button, Drawer } from "@/components/ui";
import { Field, FormError, FormSection, IconInput, IconSelectTrigger } from "@/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { Pipeline, OpportunityRow } from "@/components/OpportunitiesPage";

/** Create/edit opportunity — slides in from the right (Drawer seam). */
export function OpportunityForm({
  pipeline,
  initial,
  onClose,
  onSaved,
  canEditFields,
  canChangeStage = canEditFields,
  canAssign = false,
}: {
  pipeline: Pipeline;
  initial: OpportunityRow | null;
  canEditFields: boolean;
  canChangeStage?: boolean;
  onClose: () => void;
  onSaved: () => void;
  canAssign?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [stageId, setStageId] = useState(initial?.stageId ?? "");
  const [accountId, setAccountId] = useState(initial?.account?.id ?? "");
  const [contactId, setContactId] = useState(initial?.contact?.id ?? "");
  const [ownerUserId, setOwnerUserId] = useState((initial as (OpportunityRow & { owner?: { id: string } }) | null)?.owner?.id ?? "");
  const [teamId, setTeamId] = useState((initial as (OpportunityRow & { team?: { id: string } }) | null)?.team?.id ?? "");
  const [accountOptions, setAccountOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [contactOptions, setContactOptions] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [userOptions, setUserOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [teamOptions, setTeamOptions] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void fetch("/api/accounts?pageSize=100").then((r) => (r.ok ? r.json() : null)).then((b) => setAccountOptions(b?.data ?? []));
    void fetch("/api/contacts?pageSize=100").then((r) => (r.ok ? r.json() : null)).then((b) => setContactOptions(b?.data ?? []));
    if (canAssign) {
      void fetch("/api/users").then((r) => (r.ok ? r.json() : null)).then((b) => setUserOptions(b?.data ?? []));
      void fetch("/api/teams").then((r) => (r.ok ? r.json() : null)).then((b) => setTeamOptions(b?.data ?? []));
    }
  }, [canAssign]);
  const [value, setValue] = useState(initial?.value ? String(Number(initial.value) / 100) : "");
  const [probability, setProbability] = useState(initial ? String(initial.probability) : "");
  const [expectedCloseAt, setExpectedCloseAt] = useState(
    initial?.expectedCloseAt ? initial.expectedCloseAt.slice(0, 10) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = initial
        ? {
            ...(canEditFields ? {
              name,
              ...(accountId ? { accountId } : { accountId: null }),
              ...(contactId ? { contactId } : { contactId: null }),
              ...(value ? { value: Math.round(parseFloat(value) * 100) } : { value: null }),
              ...(probability ? { probability: parseInt(probability, 10) } : {}),
              ...(expectedCloseAt ? { expectedCloseAt } : { expectedCloseAt: null }),
            } : {}),
            ...(canChangeStage && stageId ? { stageId } : {}),
            ...(canAssign ? {
              ...(ownerUserId ? { ownerUserId } : {}),
              teamId: teamId || null,
            } : {}),
          }
        : {
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
    <Drawer
      open
      title={initial ? "Edit opportunity" : "New opportunity"}
      subtitle={`Pipeline: ${pipeline.name}`}
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="opportunity-form" variant="primary" icon="check" loading={busy}>
            Save opportunity
          </Button>
        </>
      }
    >
      <form id="opportunity-form" method="post" onSubmit={submit} className="space-y-6">
        <FormError message={error} />
        <FormSection title="Deal essentials" help="Name the opportunity and place it in the right stage.">
          <Field id="o-name" label="Name" required>
            <IconInput
              id="o-name"
              icon="tag"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fleet renewal — Q4 rollout"
              required
              minLength={2}
              disabled={!canEditFields}
            />
          </Field>
          <Field id="o-stage" label="Stage" help="Leave unset to start in the first open stage.">
            <Select
              value={stageId ? stageId : "__none__"}
              onValueChange={(v) => setStageId(v === "__none__" ? "" : v)}
              disabled={!canChangeStage}
            >
              <IconSelectTrigger id="o-stage" icon="tag">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="__none__">First open stage</SelectItem>
                {pipeline.stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="o-account" label="Account">
              <Select
                value={accountId ? accountId : "__none__"}
                onValueChange={(v) => setAccountId(v === "__none__" ? "" : v)}
                disabled={!canEditFields}
              >
                <IconSelectTrigger id="o-account" icon="building">
                  <SelectValue />
                </IconSelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="__none__">— none —</SelectItem>
                  {accountOptions.map((account) => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="o-contact" label="Contact">
              <Select
                value={contactId ? contactId : "__none__"}
                onValueChange={(v) => setContactId(v === "__none__" ? "" : v)}
                disabled={!canEditFields}
              >
                <IconSelectTrigger id="o-contact" icon="users">
                  <SelectValue />
                </IconSelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="__none__">— none —</SelectItem>
                  {contactOptions.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>
        <FormSection title="Forecast" help="Use value, probability, and close date to keep the forecast honest.">
          <div className="grid grid-cols-2 gap-3">
            <Field id="o-value" label="Value (USD)">
              <IconInput
                id="o-value"
                icon="chart"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 12500.00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!canEditFields}
              />
            </Field>
            <Field id="o-prob" label="Probability %">
              <IconInput
                id="o-prob"
                icon="chart"
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 60"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                disabled={!canEditFields}
              />
            </Field>
          </div>
          <Field id="o-close" label="Expected close">
            <IconInput
              id="o-close"
              icon="calendar"
              type="date"
              value={expectedCloseAt}
              onChange={(e) => setExpectedCloseAt(e.target.value)}
              disabled={!canEditFields}
            />
          </Field>
        </FormSection>
        {canAssign ? (
          <FormSection title="Ownership" help="Who works this deal and which team's scope it lives in.">
            <div className="grid grid-cols-2 gap-3">
              <Field id="o-owner" label="Owner">
                <Select
                  value={ownerUserId ? ownerUserId : "__none__"}
                  onValueChange={(v) => setOwnerUserId(v === "__none__" ? "" : v)}
                >
                  <IconSelectTrigger id="o-owner" icon="users">
                    <SelectValue />
                  </IconSelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">— none —</SelectItem>
                    {userOptions.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="o-team" label="Team">
                <Select
                  value={teamId ? teamId : "__none__"}
                  onValueChange={(v) => setTeamId(v === "__none__" ? "" : v)}
                >
                  <IconSelectTrigger id="o-team" icon="users">
                    <SelectValue />
                  </IconSelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">— none —</SelectItem>
                    {teamOptions.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>
        ) : null}
      </form>
    </Drawer>
  );
}
