"use client";

import Link from "next/link";
import { useCrmBranding } from "@/components/BrandingProvider";
import { Icon } from "@/components/Icon";
import { RowActions } from "@/components/RowActions";
import { Initials } from "@/components/Initials";
import { UserSmtpPanel } from "@/components/UserSmtpPanel";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/Dialogs";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { Modal } from "@/components/Modal";
import { Field, IconInput, IconSelectTrigger, SearchInput } from "@/components/form";
import { useTableSession, writeTableSession } from "@/components/useTableSession";
import { Table, THead, TBody, TR, TH, TD } from "@/components/table";
import { PERMISSION_CATEGORIES } from "@/server/permissions";
import { Button, Drawer, EmptyState } from "@/components/ui";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/* Badge tone helpers — semantic tones stay on theme tokens so the NEUTRAL
   palette maps them; no raw brand hexes. */
function badgeToneClass(tone: "success" | "warning" | "info" | "error"): string {
  switch (tone) {
    case "success":
      return "border-(--success-border) bg-(--success-bg) text-(--success)";
    case "warning":
      return "border-(--warning-border) bg-(--warning-bg) text-(--warning)";
    case "info":
      return "border-(--info-border) bg-(--info-bg) text-(--info)";
    case "error":
      return "border-(--error-border) bg-(--error-bg) text-(--error)";
  }
}

/** Small uppercase section label — replaces the legacy `.card-title` style. */
function CardLabel({ children }: { children: React.ReactNode }) {
  return <CardTitle className="text-sm font-semibold uppercase tracking-wider text-(--text-secondary)">{children}</CardTitle>;
}


function SetupFormModal({ title, onClose, children, size = "md" }: { title: string; onClose: () => void; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  return <Modal title={title} onClose={onClose} size={size}><div>{children}</div></Modal>;
}

function AdminTableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {[...Array(rows)].map((_, rowIndex) => (
        <TR key={`admin-skeleton-row-${rowIndex}`}>
          {[...Array(columns)].map((__, columnIndex) => (
            <TD key={`admin-skeleton-cell-${rowIndex}-${columnIndex}`} className="px-3 py-3">
              <Skeleton
                style={{
                  height: columnIndex === 0 ? 18 : 14,
                  width: `${columnIndex === 0 ? 80 : 58 - (columnIndex % 3) * 8}%`,
                }}
              />
            </TD>
          ))}
        </TR>
      ))}
    </>
  );
}

function AdminCardGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(cards)].map((_, index) => (
        <Card key={`admin-card-skeleton-${index}`} className="gap-0 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Skeleton style={{ height: 36, width: 36 }} />
            <div className="min-w-0 flex-1">
              <Skeleton style={{ height: 16, width: "70%" }} />
              <Skeleton className="mt-2" style={{ height: 12, width: "45%" }} />
            </div>
          </div>
          <Skeleton style={{ height: 12, width: "90%" }} />
          <Skeleton className="mt-2" style={{ height: 12, width: "60%" }} />
        </Card>
      ))}
    </div>
  );
}

export function StatusesTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; appliesTo: string; category: string; sortOrder: number; isDefault: boolean; _count: { leads: number; contacts: number; customers: number } }>>([]);
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState("LEAD");
  const [category, setCategory] = useState("OPEN");
  const [showForm, setShowForm] = useState(false);
  const [potentialRows, setPotentialRows] = useState<Array<{ id: string; name: string; sortOrder: number; isDefault: boolean; _count?: { leads: number } }>>([]);
  const [potentialName, setPotentialName] = useState("");
  const [showPotentialForm, setShowPotentialForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/record-statuses");
      if (response.ok) setRows((await response.json()).data);
      const potentialResponse = await fetch("/api/potential-statuses");
      if (potentialResponse.ok) setPotentialRows((await potentialResponse.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/record-statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, appliesTo, category, sortOrder: rows.length + 1 }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create status.");
      return;
    }
    setName("");
    void load();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete this status?",
      message: "Records currently using this status will need to be updated.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const response = await fetch(`/api/record-statuses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not delete status.");
      return;
    }
    void load();
  }

  async function makeDefault(id: string) {
    await fetch(`/api/record-statuses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Data model"
        title="Statuses"
        subtitle="Define the lifecycle language your teams use across records."
        actions={canManage ? <Button variant="primary" icon="plus" onClick={() => setShowForm(true)}>Add status</Button> : undefined}
        metrics={[{ label: "Statuses", value: rows.length, tone: "brand" }, { label: "Objects", value: new Set(rows.map((row) => row.appliesTo)).size, tone: "info" }, { label: "Defaults", value: rows.filter((row) => row.isDefault).length, tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add status" onClose={() => setShowForm(false)}>
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className="form-section-title">Lifecycle status</p><p className="form-section-help">Statuses appear on records and guide your team through the relationship lifecycle.</p></div>
          <Field label="Name" required id="s-name">
            <IconInput id="s-name" icon="tag" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Qualified" />
          </Field>
          <Field label="Applies to" id="s-applies">
            <Select value={appliesTo} onValueChange={setAppliesTo}>
              <IconSelectTrigger id="s-applies" icon="box" className="w-full">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent>
                <SelectItem value="LEAD">Leads</SelectItem>
                <SelectItem value="CONTACT">Contacts</SelectItem>
                <SelectItem value="CUSTOMER">Customers</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category" id="s-cat" help="Grouping used in reporting — converted, lost, and invalid end the lifecycle.">
            <Select value={category} onValueChange={setCategory}>
              <IconSelectTrigger id="s-cat" icon="tag" className="w-full">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
                <SelectItem value="INVALID">Invalid</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="form-actions sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" variant="primary" icon="plus">
            Add status
          </Button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card table-responsive overflow-x-auto p-2 lg:p-0">
        <Table>
          <THead>
            <TR>
              <TH className="px-3 py-2 font-medium">Name</TH>
              <TH className="px-3 py-2 font-medium">Object</TH>
              <TH className="px-3 py-2 font-medium">Category</TH>
              <TH className="px-3 py-2 font-medium">In use</TH>
              <TH className="px-3 py-2 font-medium">Default</TH>
              {canManage ? <TH className="px-3 py-2 text-right font-medium">Actions</TH> : null}
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <AdminTableSkeleton rows={5} columns={canManage ? 6 : 5} />
            ) : rows.map((row) => (
              <TR key={row.id}>
                <TD className="px-3 py-2 font-medium">{row.name}</TD>
                <TD className="px-3 py-2"><Badge className="badge badge-neutral">{row.appliesTo.toLowerCase()}</Badge></TD>
                <TD className="px-3 py-2"><Badge className="badge badge-neutral">{row.category.toLowerCase()}</Badge></TD>
                <TD className="px-3 py-2 tabular-nums text-(--text-secondary)">{row._count.leads + row._count.contacts + row._count.customers}</TD>
                <TD className="px-3 py-2">{row.isDefault ? <Badge className="badge badge-neutral">Default</Badge> : <span className="text-xs text-(--text-tertiary)">—</span>}</TD>
                {canManage ? (
                  <TD className="px-3 py-2 text-right">
                    <div className="flex justify-end">
                      <RowActions
                        actions={[
                          ...(!row.isDefault
                            ? [{ label: "Make default", icon: "check", onClick: () => void makeDefault(row.id) }]
                            : []),
                          { label: "Delete", icon: "trash", destructive: true, onClick: () => void remove(row.id) },
                        ]}
                      />
                    </div>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {confirmDialog}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3"><div><h2 className="text-sm font-semibold">Potential status</h2><p className="mt-0.5 text-xs text-(--text-tertiary)">Segment leads by commercial potential: Junior, Senior, Institutional, or VIP.</p></div>{canManage ? <Button variant="secondary" icon="plus" onClick={() => setShowPotentialForm(true)}>Add potential status</Button> : null}</div>
        {showPotentialForm && canManage ? <SetupFormModal title="Add potential status" onClose={() => setShowPotentialForm(false)}><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); const response = await fetch("/api/potential-statuses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: potentialName, sortOrder: potentialRows.length + 1 }) }); if (!response.ok) { setError("Could not create potential status."); return; } setPotentialName(""); setShowPotentialForm(false); void load(); }}><div><p className="form-section-title">Potential status</p><p className="form-section-help">Segment leads by commercial weight for prioritization and filtering.</p></div><Field label="Name" required id="potential-name" help="Ranks a lead's commercial weight — e.g. Junior, Senior, VIP."><IconInput id="potential-name" icon="tag" value={potentialName} onChange={(event) => setPotentialName(event.target.value)} required placeholder="e.g. VIP" /></Field><div className="form-actions"><Button type="button" variant="secondary" onClick={() => setShowPotentialForm(false)}>Cancel</Button><Button type="submit" variant="primary" icon="plus">Add status</Button></div></form></SetupFormModal> : null}
        {loading ? <div className="p-3"><AdminCardGridSkeleton cards={4} /></div> : <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">{potentialRows.map((status) => {
          const leadCount = status._count?.leads ?? 0;
          return (
            <Card key={status.id} className="flex-row items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{status.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {status._count ? <Badge variant="outline">{leadCount} {leadCount === 1 ? "lead" : "leads"}</Badge> : null}
                  {status.isDefault ? <Badge>default</Badge> : null}
                </div>
              </div>
              {canManage ? (
                <Button variant="tertiary" size="sm" onClick={async () => { const response = await fetch(`/api/potential-statuses/${status.id}`, { method: "DELETE" }); if (!response.ok) setError("Potential status is in use or could not be deleted."); else void load(); }} className="size-7 shrink-0 gap-0 px-0" aria-label={`Delete ${status.name}`} title={`Delete ${status.name}`}>
                  <Icon name="close" size={14} />
                </Button>
              ) : null}
            </Card>
          );
        })}</div>}
      </Card>
    </div>
  );
}

export function TagsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; color: string | null; _count: { links: number } }>>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#71717a");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tags");
      if (response.ok) setRows((await response.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create tag.");
      return;
    }
    setName("");
    void load();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete this tag?",
      message: "The tag will be removed from all records that use it.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await fetch(`/api/tags?id=${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Data model"
        title="Tags"
        subtitle="Create lightweight labels that help teams segment and scan records."
        actions={canManage ? <Button variant="primary" icon="plus" onClick={() => setShowForm(true)}>Add tag</Button> : undefined}
        metrics={[{ label: "Tags", value: rows.length, tone: "brand" }, { label: "Applied", value: rows.reduce((sum, row) => sum + row._count.links, 0), tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add tag" onClose={() => setShowForm(false)}>
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="sm:col-span-2"><p className="form-section-title">Record label</p><p className="form-section-help">Use tags for quick segmentation, prioritization, and saved views.</p></div>
          <Field label="Name" required id="t-name">
            <IconInput id="t-name" icon="tag" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. High-touch" />
          </Field>
          <Field label="Color" id="t-color" help="Shown as the tag swatch on records.">
            <Input
              id="t-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-14 cursor-pointer p-1"
              aria-label="Tag color"
              title="Choose a tag color"
            />
          </Field>
          <div className="form-actions sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" variant="primary" icon="plus">
            Add tag
          </Button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-1 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Tag library</h2>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">Use consistent labels to make records easier to filter and prioritize.</p>
          </div>
          {rows.length > 0 ? <Badge variant="outline">{rows.length} labels</Badge> : null}
        </div>
        {loading ? (
          <div className="p-3"><AdminCardGridSkeleton cards={6} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="No tags yet" description="Create your first label to start segmenting records." />
        ) : (
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className="flex-row items-center gap-3 p-4 transition-colors hover:bg-(--bg-hover)">
              <span className="h-7 w-7 shrink-0 rounded-md border border-black/10" style={{ background: row.color ?? "var(--text-tertiary)" }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="mt-0.5 text-xs text-(--text-tertiary)">{row._count.links} {row._count.links === 1 ? "record" : "records"}</p>
              </div>
              {canManage ? (
                <Button variant="tertiary" size="sm" onClick={() => void remove(row.id)} className="size-7 shrink-0 gap-0 px-0" aria-label={`Delete ${row.name}`} title={`Delete ${row.name}`}>
                  <Icon name="close" size={14} />
                </Button>
              ) : null}
            </Card>
          ))
          }</div>
        )}
      </Card>

      {confirmDialog}
    </div>
  );
}

export function FieldsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; objectType: string; key: string; label: string; fieldType: string; required: boolean; active: boolean; options: string[] | null }>>([]);
  const [objectType, setObjectType] = useState("LEAD");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [options, setOptions] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/custom-fields");
      if (response.ok) setRows((await response.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/custom-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectType,
        key,
        label,
        fieldType,
        ...(fieldType === "SELECT" || fieldType === "MULTI_SELECT"
          ? { options: options.split(",").map((entry) => entry.trim()).filter(Boolean) }
          : {}),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create field.");
      return;
    }
    setKey("");
    setLabel("");
    setOptions("");
    void load();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete this custom field?",
      message: "Existing values remain in records but are no longer validated.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Data model"
        title="Custom fields"
        subtitle="Add the business-specific details your team needs on each record."
        actions={canManage ? <Button variant="primary" icon="plus" onClick={() => setShowForm(true)}>Add field</Button> : undefined}
        metrics={[{ label: "Fields", value: rows.length, tone: "brand" }, { label: "Active", value: rows.filter((row) => row.active).length, tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add custom field" onClose={() => setShowForm(false)} size="lg">
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="space-y-4">
          <div>
            <p className="form-section-title">Add custom field</p>
            <p className="form-section-help">Define a field that can be used on records of the selected object.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Object" id="cf-object">
              <Select value={objectType} onValueChange={setObjectType}>
                <IconSelectTrigger id="cf-object" icon="box" className="w-full">
                  <SelectValue />
                </IconSelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="CONTACT">Contact</SelectItem>
                  <SelectItem value="ACCOUNT">Account</SelectItem>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Label" required id="cf-label">
              <IconInput id="cf-label" icon="tag" value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="e.g. Customer tier" />
            </Field>
            <Field label="Key" required id="cf-key" help="Lowercase camelCase, letters, numbers, and underscores.">
              <IconInput id="cf-key" icon="tag" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-zA-Z0-9_]*" title="Start with a lowercase letter; use letters, numbers, or underscores." placeholder="e.g. customerTier" />
            </Field>
            <Field label="Type" id="cf-type">
              <Select value={fieldType} onValueChange={setFieldType}>
                <IconSelectTrigger id="cf-type" icon="list" className="w-full">
                  <SelectValue />
                </IconSelectTrigger>
                <SelectContent>
                  {["TEXT", "NUMBER", "CURRENCY", "BOOLEAN", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "PHONE", "EMAIL", "URL"].map((type) => (
                    <SelectItem key={type} value={type}>{type.replaceAll("_", " ").toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {fieldType === "SELECT" || fieldType === "MULTI_SELECT" ? (
            <Field label="Options" required id="cf-options" help="Separate each option with a comma.">
              <IconInput id="cf-options" icon="list" value={options} onChange={(e) => setOptions(e.target.value)} required placeholder="e.g. New, Active, Archived" />
            </Field>
          ) : null}
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="primary" icon="plus">Add field</Button>
          </div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card table-responsive overflow-x-auto p-2 lg:p-0">
        <Table>
          <THead>
            <TR>
              <TH className="px-3 py-2 font-medium">Object</TH>
              <TH className="px-3 py-2 font-medium">Label</TH>
              <TH className="px-3 py-2 font-medium">Key</TH>
              <TH className="px-3 py-2 font-medium">Type</TH>
              <TH className="px-3 py-2 font-medium">Options</TH>
              <TH className="px-3 py-2 font-medium">State</TH>
              {canManage ? <TH className="px-3 py-2 text-right font-medium">Actions</TH> : null}
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <AdminTableSkeleton rows={6} columns={canManage ? 7 : 6} />
            ) : rows.length === 0 ? (
              <TR><TD colSpan={7}><EmptyState title="No custom fields defined" description="Add a field above to capture business-specific details on records." /></TD></TR>
            ) : (
              rows.map((row) => (
                <TR key={row.id}>
                  <TD className="px-3 py-2">{row.objectType.toLowerCase()}</TD>
                  <TD className="px-3 py-2 font-medium">{row.label}</TD>
                  <TD className="px-3 py-2 font-mono text-xs">{row.key}</TD>
                  <TD className="px-3 py-2 font-mono text-xs">{row.fieldType.replaceAll("_", " ").toLowerCase()}</TD>
                  <TD className="px-3 py-2">
                    {row.options && row.options.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {row.options.slice(0, 3).map((option) => <Badge key={option} className="badge badge-neutral">{option}</Badge>)}
                        {row.options.length > 3 ? <span className="self-center text-xs text-(--text-tertiary)">+{row.options.length - 3} more</span> : null}
                      </span>
                    ) : "—"}
                  </TD>
                  <TD className="px-3 py-2"><Badge className="badge badge-neutral">{row.active ? "active" : "hidden"}</Badge></TD>
                  {canManage ? (
                    <TD className="px-3 py-2 text-right">
                      <div className="flex justify-end">
                        <RowActions
                          actions={[
                            { label: "Delete", icon: "trash", destructive: true, onClick: () => void remove(row.id) },
                          ]}
                        />
                      </div>
                    </TD>
                  ) : null}
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>

      {confirmDialog}
    </div>
  );
}

export function PeopleTab({ canManage }: { canManage: boolean }) {
  const branding = useCrmBranding();
  const [users, setUsers] = useState<Array<{
    id: string; email: string; name: string; status: string; lastLoginAt: string | null;
    role: { key: string; name: string };
    memberships: Array<{ team: { id: string; name: string } }>;
    _count: { assignedLeads: number; ownedContacts: number; ownedAccounts: number; ownedCustomers: number; ownedOpps: number; ownedTasks: number };
  }>>([]);
  const [teams, setTeams] = useState<Array<{
    id: string; name: string; leader: { id: string; name: string } | null;
    parent: { id: string; name: string } | null;
    memberships: Array<{ user: { id: string; name: string } }>;
  }>>([]);
  const [roles, setRoles] = useState<Array<{ key: string; name: string }>>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [uEmail, setUEmail] = useState("");
  const [uName, setUName] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uRole, setURole] = useState("REP");
  const [tName, setTName] = useState("");
  const [tLeader, setTLeader] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userActivity, setUserActivity] = useState<Array<{ id: string; source: string; label: string; objectType: string; objectId: string; createdAt: string }>>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const usersResponse = await fetch("/api/admin/users");
      if (usersResponse.ok) setUsers((await usersResponse.json()).data);
      else setError("Loading users requires USERS_MANAGE.");
      const teamsResponse = await fetch("/api/admin/teams");
      if (teamsResponse.ok) setTeams((await teamsResponse.json()).data);
      const rolesResponse = await fetch("/api/admin/roles");
      if (rolesResponse.ok) setRoles((await rolesResponse.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserActivity([]);
      return;
    }
    let active = true;
    setActivityLoading(true);
    setActivityError(null);
    void fetch(`/api/admin/users?id=${selectedUserId}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null) as { data?: typeof userActivity; error?: string } | null;
        if (!response.ok) throw new Error(body?.error ?? "Unable to load user activity.");
        if (active) setUserActivity(body?.data ?? []);
      })
      .catch((cause: unknown) => { if (active) setActivityError(cause instanceof Error ? cause.message : "Unable to load user activity."); })
      .finally(() => { if (active) setActivityLoading(false); });
    return () => { active = false; };
  }, [selectedUserId]);

  const filteredUsers = useMemo(() => users
    .filter((user) => statusFilter === "ALL" || user.status === statusFilter)
    .filter((user) => `${user.name} ${user.email} ${user.role.name} ${user.memberships.map((membership) => membership.team.name).join(" ")}`.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((left, right) => sort === "lastLogin" ? (new Date(right.lastLoginAt ?? 0).getTime() - new Date(left.lastLoginAt ?? 0).getTime()) : left.name.localeCompare(right.name)), [search, sort, statusFilter, users]);
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: uEmail, name: uName, password: uPassword, roleKey: uRole }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create user.");
      return;
    }
    setShowUserForm(false);
    setUEmail(""); setUName(""); setUPassword("");
    void load();
  }

  async function patchUser(id: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/admin/users?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Update failed.");
      return;
    }
    void load();
  }

  async function suspendSelected() {
    const targets = users.filter((user) => selectedIds.includes(user.id) && user.status === "ACTIVE");
    if (targets.length === 0) return;
    const confirmed = await confirm({
      title: `Suspend ${targets.length} user${targets.length === 1 ? "" : "s"}?`,
      message: "These users will lose access immediately. Their CRM records remain intact.",
      confirmLabel: "Suspend users",
      destructive: true,
    });
    if (!confirmed) return;
    await Promise.all(targets.map((user) => fetch(`/api/admin/users?id=${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "SUSPENDED" }) })));
    setSelectedIds([]);
    void load();
  }

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tName, leaderId: tLeader || null }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create team.");
      return;
    }
    setShowTeamForm(false);
    setTName(""); setTLeader("");
    void load();
  }

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      <WorkspaceHeader
        eyebrow="Access management"
        title="Users & teams"
        subtitle={`Manage who can work in ${branding.short} and how records are shared.`}
        actions={canManage ? <Button variant="primary" icon="plus" onClick={() => setShowUserForm(true)}>New user</Button> : undefined}
        metrics={[{ label: "Total users", value: users.length, tone: "brand" }, { label: "Active", value: users.filter((user) => user.status === "ACTIVE").length, tone: "success" }, { label: "Teams", value: teams.length, tone: "info" }, { label: "Roles", value: roles.length, tone: "warning" }]}
      />
      {showUserForm && canManage ? (
        <SetupFormModal title="New user" onClose={() => setShowUserForm(false)}>
        <form method="post" onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className="form-section-title">Access profile</p><p className="form-section-help">Create a person, then assign their role and scope.</p></div>
          <Field label="Email" required id="au-email" help="Used for sign-in and notifications.">
            <IconInput id="au-email" icon="mail" type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} required placeholder="ada@company.com" />
          </Field>
          <Field label="Name" required id="au-name">
            <IconInput id="au-name" icon="users" value={uName} onChange={(e) => setUName(e.target.value)} required placeholder="e.g. Ada Lovelace" />
          </Field>
          <Field label="Password" required id="au-pass" help="Minimum 10 characters.">
            <IconInput id="au-pass" icon="shield" type="password" value={uPassword} onChange={(e) => setUPassword(e.target.value)} required minLength={10} placeholder="••••••••••" />
          </Field>
          <Field label="Role" id="au-role" help="Controls what this user can see and do.">
            <Select value={uRole} onValueChange={setURole}>
              <IconSelectTrigger id="au-role" icon="shield" className="w-full">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent>
                {roles.map((role) => <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="form-actions sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setShowUserForm(false)}>Cancel</Button><Button type="submit" variant="primary" icon="plus">Create user</Button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card table-responsive overflow-x-auto">
        <div className="flex flex-col gap-3 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold">People</h3>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">Roles, access, and activity across your workspace</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="people-search" className="sr-only">Search users</label>
            <SearchInput id="people-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, roles, teams" wrapperClassName="w-full sm:w-64" />
            <div role="group" aria-label="Filter by status" className="flex rounded-md border border-(--border-strong) p-0.5">
              {(["ALL", "ACTIVE", "SUSPENDED", "DISABLED"] as const).map((value) => {
                const label = value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase();
                const active = statusFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(value)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${active ? "bg-(--bg-surface) text-(--text-primary) shadow-sm" : "text-(--text-secondary) hover:text-(--text-primary)"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort users" className="w-fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="lastLogin">Last login</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{filteredUsers.length} of {users.length}</Badge>
          </div>
        </div>
        {canManage && selectedIds.length > 0 ? <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-selected) px-4 py-2 text-sm"><span>{selectedIds.length} selected</span><Button variant="destructive" size="sm" icon="x_circle" onClick={() => void suspendSelected()}>Suspend selected</Button></div> : null}
        <Table>
          <THead>
            <TR>
              {canManage ? <TH className="w-10 px-3 py-2"><Checkbox aria-label="Select all visible users" checked={filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.includes(user.id)) ? true : filteredUsers.some((user) => selectedIds.includes(user.id)) ? "indeterminate" : false} onCheckedChange={(checked) => setSelectedIds(checked === true ? filteredUsers.map((user) => user.id) : [])} /></TH> : null}
              <TH className="px-3 py-2 font-medium">User</TH>
              <TH className="px-3 py-2 font-medium">Role</TH>
              <TH className="px-3 py-2 font-medium">Teams</TH>
              <TH className="px-3 py-2 font-medium">Last login</TH>
              <TH className="px-3 py-2 font-medium">Status</TH>
              {canManage ? <TH className="px-3 py-2 text-right font-medium">Actions</TH> : null}
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <AdminTableSkeleton rows={6} columns={canManage ? 6 : 5} />
            ) : filteredUsers.map((user) => (
              <TR key={user.id} className={selectedUserId === user.id ? "bg-(--bg-selected)" : undefined}>
                {canManage ? <TD className="px-3 py-2"><Checkbox aria-label={`Select ${user.name}`} checked={selectedIds.includes(user.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...current, user.id] : current.filter((id) => id !== user.id))} /></TD> : null}
                <TD className="px-3 py-2"><button type="button" onClick={() => setSelectedUserId(user.id)} className="flex items-center gap-3 text-left"><Initials name={user.name} size="md" /><span><span className="block font-medium hover:text-(--text-brand)">{user.name}</span><span className="block text-xs text-(--text-tertiary)">{user.email}</span></span></button></TD>
                <TD>
                  {canManage ? (
                    <Select value={user.role.key} onValueChange={(value) => void patchUser(user.id, { roleKey: value })}>
                      <SelectTrigger aria-label={`Role for ${user.name}`} size="sm" className="h-7 w-full max-w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : user.role.name}
                </TD>
                <TD className="px-3 py-2 text-xs">{user.memberships.map((m) => m.team.name).join(", ") || "—"}</TD>
                <TD className="px-3 py-2 whitespace-nowrap text-xs">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "never"}</TD>
                <TD className="px-3 py-2"><Badge className="badge badge-neutral">{user.status.charAt(0) + user.status.slice(1).toLowerCase()}</Badge></TD>
                {canManage ? (
                  <TD className="px-3 py-2 text-right">
                    <div className="flex justify-end">
                      <RowActions
                        actions={[
                          { label: "View profile", icon: "users", onClick: () => setSelectedUserId(user.id) },
                          {
                            label: user.status === "ACTIVE" ? "Suspend access" : "Restore access",
                            icon: user.status === "ACTIVE" ? "x_circle" : "play",
                            onClick: () => void patchUser(user.id, { status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }),
                          },
                          {
                            label: "Delete",
                            icon: "trash",
                            destructive: true,
                            onClick: async () => {
                              const ok = await confirm({
                                title: `Permanently delete "${user.name}"?`,
                                message: `${user.email} — all owned records will be reassigned to you. This action cannot be undone.`,
                                confirmLabel: "Delete user",
                                destructive: true,
                              });
                              if (!ok) return;
                              const response = await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" });
                              if (!response.ok) {
                                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                                setError(body?.error ?? "Delete failed.");
                                return;
                              }
                              void load();
                            },
                          },
                        ]}
                      />
                    </div>
                  </TD>
                ) : null}
              </TR>
            ))}
            {!loading && filteredUsers.length === 0 ? (
              <TR>
                <TD colSpan={canManage ? 7 : 5}>
                  <EmptyState title="No users match this view" description="Adjust the search or status filter." />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>

      {selectedUser ? (
        <Drawer
          open
          title={selectedUser.name}
          subtitle={selectedUser.email}
          onClose={() => setSelectedUserId(null)}
          width="lg"
          label={`Profile for ${selectedUser.name}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${selectedUser.status === "ACTIVE" ? "bg-(--success-bg) text-(--success)" : selectedUser.status === "SUSPENDED" ? "bg-(--warning-bg) text-(--warning)" : "bg-(--bg-subtle) text-(--text-secondary)"}`}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${selectedUser.status === "ACTIVE" ? "bg-(--success)" : selectedUser.status === "SUSPENDED" ? "bg-(--warning)" : "bg-(--text-tertiary)"}`} />
              {selectedUser.status.charAt(0) + selectedUser.status.slice(1).toLowerCase()}
            </span>
            <span className="rounded-full bg-(--bg-subtle) px-2 py-0.5 text-xs font-medium text-(--text-secondary)">{selectedUser.role.name} role</span>
            <span className="text-xs text-(--text-tertiary)">
              Last login {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "never"}
            </span>
          </div>

          <Tabs key={selectedUser.id} defaultValue="profile" className="mt-4">
            <TabsList variant="line">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="workspace">Workspace</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              {canManage ? <TabsTrigger value="smtp">SMTP access</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="profile" className="mt-4 space-y-5">
              <div className="flex items-center gap-3">
                <Avatar className="size-11 rounded-xl text-sm font-bold" style={{ background: "var(--brand-100)", color: "var(--brand-800)" }}>
                  <AvatarFallback className="rounded-xl bg-transparent text-sm font-bold">{selectedUser.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardLabel>Access</CardLabel>
                  <p className="mt-0.5 text-sm text-(--text-secondary)">
                    {selectedUser.role.name} · {selectedUser.status.toLowerCase()}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="ml-auto shrink-0"
                    onClick={() => void patchUser(selectedUser.id, { status: selectedUser.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}
                  >
                    {selectedUser.status === "ACTIVE" ? "Suspend access" : "Restore access"}
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div><CardLabel>Role</CardLabel><p className="mt-1 font-medium">{selectedUser.role.name}</p></div>
                <div><CardLabel>Last login</CardLabel><p className="mt-1 font-medium">{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "Never"}</p></div>
              </div>
              <div className="border-t border-(--border-default) pt-4">
                <CardLabel>Team assignments</CardLabel>
                <p className="mt-1 text-sm">{selectedUser.memberships.map((membership) => membership.team.name).join(", ") || "No teams assigned"}</p>
              </div>
            </TabsContent>

            <TabsContent value="workspace" className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href={`/emails?userId=${selectedUser.id}&userName=${encodeURIComponent(selectedUser.name)}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-(--bg-hover)"><Icon name="mail" size={16} className="text-(--text-tertiary)" /><span className="text-sm font-medium">Mailbox</span></Link>
                <Link href={`/leads?assignment=user:${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-(--bg-hover)"><Icon name="target" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.assignedLeads}</span><span className="block text-xs text-(--text-secondary)">Leads</span></span></Link>
                <Link href={`/contacts?ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-(--bg-hover)"><Icon name="users" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedContacts}</span><span className="block text-xs text-(--text-secondary)">Contacts</span></span></Link>
                <Link href={`/accounts?ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-(--bg-hover)"><Icon name="building" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedAccounts}</span><span className="block text-xs text-(--text-secondary)">Accounts</span></span></Link>
                <Link href={`/customers?ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-(--bg-hover)"><Icon name="heart" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedCustomers}</span><span className="block text-xs text-(--text-secondary)">Customers</span></span></Link>
                <Link href={`/opportunities?ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-(--bg-hover)"><Icon name="trending" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedOpps}</span><span className="block text-xs text-(--text-secondary)">Opportunities</span></span></Link>
                <Link href={`/tasks?mine=0&ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-(--bg-hover)"><Icon name="check" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedTasks}</span><span className="block text-xs text-(--text-secondary)">Tasks</span></span></Link>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <CardLabel>Recent activity</CardLabel>
                <span className="text-[11px] text-(--text-tertiary)">{userActivity.length} events</span>
              </div>
              {activityError ? <p role="alert" className="mt-2 text-sm text-(--error)">{activityError}</p> : activityLoading ? <div className="mt-2 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div> : userActivity.length === 0 ? <p className="mt-2 text-sm text-(--text-tertiary)">No recorded activity yet.</p> : <ul className="mt-2 space-y-2">{userActivity.map((event) => <li key={event.id} className="flex items-start justify-between gap-3 rounded-md border border-(--border-default) px-3 py-2 text-sm"><span><span className="font-medium">{event.label}</span><span className="ml-2 text-xs text-(--text-tertiary)">{event.objectType.toLowerCase()}</span></span><time className="shrink-0 text-[11px] text-(--text-tertiary)">{new Date(event.createdAt).toLocaleDateString()}</time></li>)}</ul>}
            </TabsContent>

            {canManage ? (
              <TabsContent value="smtp" className="mt-4">
                <UserSmtpPanel userId={selectedUser.id} userEmail={selectedUser.email} />
              </TabsContent>
            ) : null}
          </Tabs>
        </Drawer>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-(--border-default) pb-3 pt-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardLabel>Structure</CardLabel>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Teams <span className="text-sm font-normal text-(--text-tertiary)">{teams.length}</span></h3>
        </div>
        {canManage ? (
          <Button variant="secondary" icon="plus" onClick={() => setShowTeamForm((p) => !p)}>
            New team
          </Button>
        ) : null}
      </div>
      {showTeamForm && canManage ? (
        <SetupFormModal title="New team" onClose={() => setShowTeamForm(false)}>
        <form method="post" onSubmit={createTeam} className="space-y-4">
          <div><p className="form-section-title">Team structure</p><p className="form-section-help">Teams shape visibility, ownership, and collaboration.</p></div>
          <Field label="Name" required id="at-name">
            <IconInput id="at-name" icon="users" value={tName} onChange={(e) => setTName(e.target.value)} required minLength={2} placeholder="e.g. EMEA desk" />
          </Field>
          <Field label="Leader" id="at-leader" help="Optional — shown as the team lead.">
            <Select value={tLeader || "__none__"} onValueChange={(value) => setTLeader(value === "__none__" ? "" : value)}>
              <IconSelectTrigger id="at-leader" icon="users" className="w-full">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— none —</SelectItem>
                {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setShowTeamForm(false)}>Cancel</Button><Button type="submit" variant="primary" icon="plus">Create team</Button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {loading ? (
          <AdminCardGridSkeleton cards={4} />
        ) : teams.map((team) => (
          <Card key={team.id} className="gap-0 p-4 text-sm transition-colors hover:bg-(--bg-hover)">
            <div className="mb-2 flex items-center justify-between gap-2"><p className="font-semibold">{team.name}</p><Badge variant="outline">{team.memberships.length} members</Badge></div>
            <p className="text-xs text-(--text-secondary)">Lead: {team.leader?.name ?? "Unassigned"}{team.parent ? <span className="text-(--text-tertiary)"> · under {team.parent.name}</span> : null}</p>
            <p className="mt-2 truncate text-xs text-(--text-tertiary)">{team.memberships.map((m) => m.user.name).join(", ") || "No members assigned"}</p>
            {canManage ? (
              <button
                type="button"
                onClick={async () => {
                  const okTeam = await confirm({
                    title: `Delete team “${team.name}”?`,
                    message: "Members of this team will no longer see each other's records through team scope.",
                    confirmLabel: "Delete team",
                    destructive: true,
                  });
                  if (!okTeam) return;
                  const response = await fetch(`/api/admin/teams?id=${team.id}`, { method: "DELETE" });
                  if (!response.ok) {
                    const body = (await response.json().catch(() => null)) as { error?: string } | null;
                    setError(body?.error ?? "Delete failed.");
                    return;
                  }
                  void load();
                }}
                className="mt-1 text-xs text-(--error) hover:underline"
              >
                delete
              </button>
            ) : null}
          </Card>
        ))}
      </div>

      {confirmDialog}
    </div>
  );
}

export function RolesTab({ canManage = false }: { canManage?: boolean }) {
  const branding = useCrmBranding();
  const [roles, setRoles] = useState<Array<{
    id: string; key: string; name: string; description: string | null; isSystem: boolean;
    scope: string;
    permissions: Array<{ permission: string }>;
    _count: { users: number };
  }>>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>(PERMISSION_CATEGORIES.slice(0, 1).map((category) => category.key));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/roles");
      if (!response.ok) {
        setError("Loading roles requires admin access.");
        return;
      }
      const body = (await response.json()) as { data: typeof roles; meta: { allPermissions: string[] } };
      setRoles(body.data);
      setSelectedRoleId((current) => current ?? body.data[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(roleId: string, permission: string, enabled: boolean) {
    const role = roles.find((entry) => entry.id === roleId);
    if (!role) return;
    const next = enabled
      ? [...role.permissions.map((entry) => entry.permission), permission]
      : role.permissions.map((entry) => entry.permission).filter((entry) => entry !== permission);
    const response = await fetch(`/api/admin/roles?id=${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: next }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Update failed.");
      return;
    }
    setError(null);
    void load();
  }

  async function setCategory(roleId: string, permissions: readonly { key: string }[], enabled: boolean) {
    const role = roles.find((entry) => entry.id === roleId);
    if (!role || role.key === "SUPER_ADMIN") return;
    const current = new Set(role.permissions.map((entry) => entry.permission));
    permissions.forEach(({ key }) => enabled ? current.add(key) : current.delete(key));
    const response = await fetch(`/api/admin/roles?id=${roleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions: [...current] }) });
    if (!response.ok) setError("Update failed."); else void load();
  }

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const visibleCategories = PERMISSION_CATEGORIES.map((category) => ({
    ...category,
    permissions: category.permissions.filter((permission) => !query || category.label.toLowerCase().includes(query.toLowerCase()) || permission.label.toLowerCase().includes(query.toLowerCase())),
  })).filter((category) => category.permissions.length > 0);

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Access management"
        title="Roles & permissions"
        subtitle={`Control what each team role can see and do across ${branding.short}.`}
        metrics={[{ label: "Roles", value: roles.length, tone: "brand" }, { label: "Categories", value: PERMISSION_CATEGORIES.length, tone: "info" }, { label: "Assigned users", value: roles.reduce((sum, role) => sum + role._count.users, 0), tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {loading ? (
        <AdminCardGridSkeleton cards={3} />
      ) : selectedRole ? <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div><Label htmlFor="role-select">Role</Label><Select value={selectedRole.id} onValueChange={setSelectedRoleId}><IconSelectTrigger id="role-select" icon="shield" className="mt-1 min-w-56 w-full font-semibold sm:w-56"><SelectValue /></IconSelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select><p className="mt-2 text-xs text-(--text-secondary)">{selectedRole.description} · {selectedRole._count.users} assigned users · {selectedRole.scope.toLowerCase()} scope</p></div>
          <div className="w-full sm:w-64"><label htmlFor="permission-search" className="sr-only">Search permissions</label><SearchInput id="permission-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search permissions" /></div>
        </div>
        <Accordion type="multiple" value={expanded} onValueChange={setExpanded} className="divide-y divide-(--border-default)">
          {visibleCategories.map((category) => {
            const enabledCount = category.permissions.filter(({ key }) => selectedRole.permissions.some((entry) => entry.permission === key)).length;
            const locked = selectedRole.key === "SUPER_ADMIN" || !canManage;
            return (
              <AccordionItem key={category.key} value={category.key} className="border-b-0">
                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-(--bg-hover)">
                  <AccordionTrigger className="gap-2 py-0 text-sm font-medium hover:no-underline">
                    {category.label}
                  </AccordionTrigger>
                  <Badge variant="outline" className="shrink-0">{enabledCount} / {category.permissions.length} enabled</Badge>
                  <Button type="button" variant="tertiary" size="sm" icon="check" disabled={locked} onClick={() => void setCategory(selectedRole.id, category.permissions, true)} className="shrink-0">Enable all</Button>
                  <Button type="button" variant="tertiary" size="sm" icon="close" disabled={locked} onClick={() => void setCategory(selectedRole.id, category.permissions, false)} className="shrink-0">Disable all</Button>
                </div>
                <AccordionContent className="pb-0">
                  <div className="grid gap-1 border-t border-(--border-default) bg-(--bg-surface) px-12 py-2 sm:grid-cols-2 lg:grid-cols-3">
                    {category.permissions.map(({ key, label }) => {
                      const enabled = selectedRole.permissions.some((entry) => entry.permission === key);
                      return (
                        <label key={key} htmlFor={`perm-${selectedRole.id}-${key}`} className={`flex items-center gap-2 rounded px-2 py-2 text-sm ${enabled ? "bg-(--bg-subtle) text-(--text-primary)" : "text-(--text-tertiary)"}`}>
                          <Checkbox id={`perm-${selectedRole.id}-${key}`} checked={enabled} disabled={locked} onCheckedChange={(checked) => void toggle(selectedRole.id, key, checked === true)} />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Card> : null}
    </div>
  );
}

export function SettingsTab() {
  const branding = useCrmBranding();
  const [settings, setSettings] = useState<Array<{ id: string; key: string; value: unknown }>>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) setSettings((await response.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Save failed.");
      return;
    }
    setKey(""); setValue("");
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Workspace behavior"
        title="Settings"
        subtitle={`Manage organization-level defaults used throughout ${branding.short}.`}
        actions={<Button variant="primary" icon="plus" onClick={() => setShowForm(true)}>Add setting</Button>}
        metrics={[{ label: "Configured", value: settings.length, tone: "brand" }, { label: "Storage", value: "Workspace", tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm ? <SetupFormModal title="Add workspace setting" onClose={() => setShowForm(false)}>
      <form method="post" onSubmit={async (event) => { await save(event); setShowForm(false); }} className="space-y-4">
        <div><p className="form-section-title">Workspace default</p><p className="form-section-help">Use a namespaced key such as org.currency or tasks.defaultDueDays.</p></div>
        <Field label="Key" required id="set-key" help="Lowercase, dot-namespaced.">
          <IconInput id="set-key" icon="tag" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9_.]*" placeholder="e.g. org.currency" />
        </Field>
        <Field label="Value" required id="set-value" help="JSON, number, or string.">
          <IconInput id="set-value" icon="sliders" value={value} onChange={(e) => setValue(e.target.value)} required placeholder="e.g. EUR" />
        </Field>
        <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" variant="primary" icon="plus">Save setting</Button></div>
      </form>
      </SetupFormModal> : null}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3">
          <h2 className="text-sm font-semibold">Configured values</h2>
          <p className="mt-0.5 text-xs text-(--text-tertiary)">Changes are applied across the workspace.</p>
        </div>
        {loading ? (
          <div className="p-4">
            {[...Array(4)].map((_, index) => (
              <div key={`settings-skeleton-${index}`} className="flex items-center justify-between gap-4 border-b border-(--border-default) py-3 last:border-0">
                <Skeleton style={{ height: 14, width: "35%" }} />
                <Skeleton style={{ height: 14, width: "22%" }} />
              </div>
            ))}
          </div>
        ) : settings.length === 0 ? (
          <EmptyState title="No settings yet" description="Add a workspace default above to make it available to the CRM." />
        ) : (
          <CardContent>
            <dl className="admin-desc-list">
              {settings.map((setting) => (
                <Fragment key={setting.id}>
                  <dt className="font-mono">{setting.key}</dt>
                  <dd className="font-medium">{String(setting.value)}</dd>
                </Fragment>
              ))}
            </dl>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export function AuditTab() {
  const [entries, setEntries] = useState<Array<{ id: string; action: string; objectType: string; objectId: string | null; actor: { name: string } | null; createdAt: string; after: unknown }>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Page/pageSize survive a refresh (sessionStorage), same pattern as the
  // record lists: restore once after mount, gate the first fetch until the
  // snapshot is applied, then write back whenever the pager state changes.
  const { session, ready } = useTableSession("admin:audit");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (session) {
      if (session.page !== undefined) setPage(session.page);
      if (session.pageSize !== undefined) setPageSize(session.pageSize);
    }
    setHydrated(true);
  }, [ready, session]);

  useEffect(() => {
    if (!hydrated) return;
    writeTableSession("admin:audit", { page, pageSize });
  }, [hydrated, page, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/audit?page=${page}&pageSize=${pageSize}`);
      if (!response.ok) return;
      const body = (await response.json()) as { data: typeof entries; meta: { total: number } };
      setEntries(body.data);
      setTotal(body.meta.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);
  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  // A restored page can outrun the result set (data changed since the last
  // visit) — clamp to the last real page instead of showing an empty one.
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (!hydrated || loading) return;
    if (page > totalPages) setPage(totalPages);
  }, [hydrated, loading, page, totalPages]);

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Governance"
        title="Audit log"
        subtitle="Review configuration and record changes across your workspace."
        metrics={[{ label: "Entries", value: total, tone: "brand" }, { label: "Page", value: page, tone: "info" }, { label: "Page size", value: pageSize, tone: "success" }]}
      />
      <div className="card table-responsive overflow-x-auto">
        <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3">
          <div><h2 className="text-sm font-semibold">Recent activity</h2><p className="mt-0.5 text-xs text-(--text-tertiary)">Append-only history of important changes.</p></div>
          <Badge className="badge badge-neutral">{total} entries</Badge>
        </div>
        <Table>
          <THead>
            <TR>
              <TH className="px-3 py-2 font-medium">When</TH>
              <TH className="px-3 py-2 font-medium">Actor</TH>
              <TH className="px-3 py-2 font-medium">Action</TH>
              <TH className="px-3 py-2 font-medium">Object</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <AdminTableSkeleton rows={8} columns={4} />
            ) : entries.map((entry) => (
              <TR key={entry.id}>
                <TD className="px-3 py-2 whitespace-nowrap text-xs text-(--text-secondary)">
                  {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}
                </TD>
                <TD className="px-3 py-2"><span className="flex items-center gap-1.5">{entry.actor?.name ? <><Initials name={entry.actor.name} size="xs" /><span className="font-medium">{entry.actor.name}</span></> : <span className="font-medium">System</span>}</span></TD>
                <TD className="px-3 py-2"><Badge className="badge badge-neutral whitespace-nowrap">{entry.action.replaceAll("_", " ").toLowerCase()}</Badge></TD>
                <TD className="px-3 py-2 text-xs text-(--text-secondary)">
                  <span className="font-medium text-(--text-primary)">{entry.objectType.toLowerCase()}</span>
                  {entry.objectId ? ` · …${entry.objectId.slice(-6)}` : ""}
                </TD>
              </TR>
            ))}
            {!loading && entries.length === 0 ? (
              <TR><TD colSpan={4}><EmptyState title="No audit entries yet" description="Configuration and record changes will appear here as they happen." /></TD></TR>
            ) : null}
          </TBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-(--text-secondary)">
        <span>
          {total > 0 ? (
            <>Showing <strong className="text-(--text-primary)">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</strong> of {total}</>
          ) : (
            <>Page {page} of {totalPages}</>
          )}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Rows
            <Select
              value={String(pageSize)}
              onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}
            >
              <SelectTrigger aria-label="Rows per page" size="sm" className="h-7 w-fit text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" icon="chevron_right" disabled={page * pageSize >= total} onClick={() => setPage((current) => current + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}


export function IntegrationsTab() {
  const branding = useCrmBranding();
  const [status, setStatus] = useState<{
    platformBridge: { enabled: boolean; url: string | null };
    email: { enabled: boolean; from: string | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/admin/integrations")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setStatus(body?.data ?? null))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Connections"
        title="Integrations"
        subtitle={`Connect ${branding.short} to the services your team depends on.`}
        metrics={[
          { label: "Connections", value: status ? 2 : "—", tone: "brand" },
          { label: "Configured", value: status ? [status.platformBridge.enabled, status.email.enabled].filter(Boolean).length : "—", tone: "success" },
          { label: "Mode", value: "Read-only safe", tone: "info" },
        ]}
      />
      {loading ? <AdminCardGridSkeleton cards={2} /> : !status ? <p className="text-sm text-(--text-tertiary)">Unable to check connection status.</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <IntegrationCard
            title="Trading-platform bridge"
            description="Read-only client-360 access to KYC, wallets, and payments for linked customers."
            enabled={status.platformBridge.enabled}
            detail={status.platformBridge.url ? status.platformBridge.url : "Set PLATFORM_BRIDGE_URL + PLATFORM_BRIDGE_TOKEN in the environment."}
          />
          <IntegrationCard
            title="Email notifications"
            description="Send assignment, task, overdue, and import notifications by email."
            enabled={status.email.enabled}
            detail={status.email.from ? `From: ${status.email.from}` : "Set SMTP_URL + SMTP_FROM in the environment."}
          />
        </div>
      )}
    </div>
  );
}

function IntegrationCard({ title, description, enabled, detail }: { title: string; description: string; enabled: boolean; detail: string }) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-(--border-default) bg-(--bg-subtle) text-(--text-secondary)" aria-hidden>
            <Icon name="plug" size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-medium">{title}</h2>
            <p className="mt-1 text-sm text-(--text-secondary)">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className={enabled ? badgeToneClass("success") : undefined}>{enabled ? "Connected" : "Not configured"}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-(--border-default) pt-3 text-xs text-(--text-tertiary)"><span aria-hidden className={`h-2 w-2 rounded-full ${enabled ? "bg-(--success)" : "bg-(--text-tertiary)"}`} />{detail}</div>
    </Card>
  );
}


export function ObjectsTab() {
  const branding = useCrmBranding();
  const [objects, setObjects] = useState<Array<{
    id: string; key: string; name: string; pluralName: string;
    description: string | null; icon: string | null; active: boolean;
    fields: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] | null }> | null;
    _count: { records: number };
  }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [pluralName, setPluralName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldsJson, setFieldsJson] = useState('[{"key":"title","label":"Title","type":"TEXT","required":true,"sortOrder":1}]');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/objects");
      if (response.ok) setObjects((await response.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    let fields: unknown;
    try {
      fields = JSON.parse(fieldsJson);
    } catch {
      setError("Fields must be valid JSON.");
      return;
    }
    const response = await fetch("/api/admin/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, name, pluralName, description: description || null, fields }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create object.");
      return;
    }
    setShowForm(false);
    setKey(""); setName(""); setPluralName(""); setDescription("");
    void load();
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/admin/objects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Data model"
        title="Custom objects"
        subtitle={`Extend ${branding.short} with record types that match how your business works.`}
        actions={<Button variant="primary" icon="plus" onClick={() => setShowForm(true)}>New object type</Button>}
        metrics={[{ label: "Object types", value: objects.length, tone: "brand" }, { label: "Active", value: objects.filter((object) => object.active).length, tone: "success" }, { label: "Records", value: objects.reduce((sum, object) => sum + object._count.records, 0), tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      <div className="rounded-lg border border-(--info-border) bg-(--info-bg) px-4 py-3 text-sm text-(--info)">
        <p>
          Admin-defined record types (e.g. Properties, Vendors, Deals) — records are JSONB documents validated against each object&#39;s field schema.
        </p>
      </div>

      {showForm ? (
        <SetupFormModal title="New custom object" onClose={() => setShowForm(false)} size="lg">
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="space-y-4">
          <div><p className="form-section-title">Object definition</p><p className="form-section-help">Define the identity and fields for a new record type.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Key (URL slug)" required id="co-key">
              <IconInput id="co-key" icon="tag" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9-]*" placeholder="properties" />
            </Field>
            <Field label="Name (singular)" required id="co-name">
              <IconInput id="co-name" icon="tag" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Property" />
            </Field>
            <Field label="Plural name" required id="co-plural">
              <IconInput id="co-plural" icon="list" value={pluralName} onChange={(e) => setPluralName(e.target.value)} required placeholder="Properties" />
            </Field>
          </div>
          <Field label="Description" id="co-desc" help="Optional — one line shown under the object name.">
            <IconInput id="co-desc" icon="note" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Properties we manage for clients" />
          </Field>
          <Field
            label="Fields (JSON array)"
            id="co-fields"
            help="Each entry: key, label, type, required, options, sortOrder — types: TEXT, NUMBER, CURRENCY, BOOLEAN, DATE, DATETIME, SELECT, MULTI_SELECT, PHONE, EMAIL, URL."
          >
            <Textarea
              id="co-fields"
              value={fieldsJson}
              onChange={(e) => setFieldsJson(e.target.value)}
              rows={6}
              className="font-mono"
              placeholder={'[{"key":"title","label":"Title","type":"TEXT","required":true,"sortOrder":1},{"key":"price","label":"Price","type":"NUMBER","sortOrder":2}]'}
            />
          </Field>
          <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" variant="primary" icon="plus">Create object</Button></div>
        </form>
        </SetupFormModal>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {loading ? (
          <AdminCardGridSkeleton cards={4} />
        ) : objects.map((object) => (
          <Card key={object.id} className="gap-0 p-4 transition-colors hover:bg-(--bg-hover)">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-medium">
                  {object.pluralName}
                  <span className="ml-2 font-mono text-xs text-(--text-tertiary)">/{object.key}</span>
                </p>
                {object.description ? <p className="text-xs text-(--text-secondary)">{object.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline" className={object.active ? badgeToneClass("success") : undefined}>{object.active ? "active" : "inactive"}</Badge><Badge variant="outline">{object._count.records} records</Badge><Badge variant="outline">{object.fields?.length ?? 0} fields</Badge></div>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => void toggleActive(object.id, !object.active)} className="text-(--brand) hover:underline">
                  {object.active ? "deactivate" : "activate"}
                </button>
                {object._count.records === 0 ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete "${object.pluralName}"?`,
                        message: "The object definition and its record layout will be removed.",
                        confirmLabel: "Delete",
                        destructive: true,
                      });
                      if (!ok) return;
                      const response = await fetch(`/api/admin/objects/${object.id}`, { method: "DELETE" });
                      if (!response.ok) {
                        const body = (await response.json().catch(() => null)) as { error?: string } | null;
                        setError(body?.error ?? "Delete failed.");
                        return;
                      }
                      void load();
                    }}
                    className="text-(--error) hover:underline"
                  >
                    delete
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 border-t border-(--border-default) pt-3 text-xs text-(--text-tertiary)">
              {object.fields?.map((field) => field.label).join(", ") || "No fields defined"}
            </div>
          </Card>
        ))}
        {!loading && objects.length === 0 ? (
          <Card className="gap-0 p-6 text-sm text-(--text-tertiary)">
            No custom objects yet — create one above (e.g. Properties, Vendors).
          </Card>
        ) : null}
      </div>

      {confirmDialog}
    </div>
  );
}
