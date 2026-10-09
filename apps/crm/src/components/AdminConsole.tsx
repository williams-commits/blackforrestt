"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useCrmBranding } from "@/components/BrandingProvider";
import { Icon } from "@/components/Icon";
import { RowActions } from "@/components/RowActions";
import { Initials } from "@/components/Initials";
import { UserSmtpPanel } from "@/components/UserSmtpPanel";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/Dialogs";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { Modal } from "@/components/Modal";
import { Field, FormError, IconInput, IconSelectTrigger, SearchInput } from "@/components/form";
import { useTableSession, writeTableSession } from "@/components/useTableSession";
import { PERMISSION_CATEGORIES } from "@/server/permissions";
import { Button, Drawer, EmptyState } from "@/components/ui";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PresenceDot, usePresence } from "@/components/Presence";
import { useTabSession } from "@/components/useTabSession";
import { EntityList } from "@/components/admin/EntityList";
import { relativeTime } from "@/lib/time";

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
  return <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</CardTitle>;
}


function SetupFormModal({ title, onClose, children, size = "md" }: { title: string; onClose: () => void; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  return <Modal title={title} onClose={onClose} size={size}><div>{children}</div></Modal>;
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
  const [rows, setRows] = useState<Array<{ id: string; name: string; appliesTo: string; category: string; sortOrder: number; isDefault: boolean; color: string | null; _count: { leads: number; contacts: number; customers: number } }>>([]);
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState("LEAD");
  const [category, setCategory] = useState("OPEN");
  const [color, setColor] = useState("#71717a");
  const [showForm, setShowForm] = useState(false);
  const [potentialRows, setPotentialRows] = useState<Array<{ id: string; name: string; sortOrder: number; isDefault: boolean; _count?: { leads: number } }>>([]);
  const [potentialName, setPotentialName] = useState("");
  const [showPotentialForm, setShowPotentialForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [potentialBusy, setPotentialBusy] = useState(false);
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
    setBusy(true);
    try {
      const response = await fetch("/api/record-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, appliesTo, category, color, sortOrder: rows.length + 1 }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not create status.");
        return;
      }
      setShowForm(false);
      setName("");
      setColor("#71717a");
      toast.success("Status created", { description: `${name} is now available on records.` });
      void load();
    } finally {
      setBusy(false);
    }
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
    toast.success("Status deleted");
    void load();
  }

  async function makeDefault(id: string) {
    const response = await fetch(`/api/record-statuses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (response.ok) toast.success("Default status updated");
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Data model"
        title="Statuses" titleIcon="sliders"
        subtitle="Define the lifecycle language your teams use across records."
        actions={canManage ? <Button variant="primary" icon="plus" onClick={() => { setError(null); setColor("#71717a"); setShowForm(true); }}>Add status</Button> : undefined}
        metrics={[{ label: "Statuses", value: rows.length, tone: "brand" }, { label: "Objects", value: new Set(rows.map((row) => row.appliesTo)).size, tone: "info" }, { label: "Defaults", value: rows.filter((row) => row.isDefault).length, tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add status" onClose={() => { setError(null); setShowForm(false); }}>
        <form method="post" onSubmit={create} className="grid gap-4 sm:grid-cols-2">
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
          <div className="sm:col-span-2">
            <Field label="Color" id="s-color">
              <div className="flex flex-wrap items-center gap-2">
                {TAG_COLOR_PRESETS.map((preset) => {
                  const selected = color.toLowerCase() === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      aria-label={`Color: ${preset.name}`}
                      aria-pressed={selected}
                      onClick={() => setColor(preset.value)}
                      className={`size-7 shrink-0 rounded-full border border-black/10 transition-transform hover:scale-110 ${selected ? "ring-2 ring-ring ring-offset-2 ring-offset-popover" : ""}`}
                      style={{ background: preset.value }}
                    />
                  );
                })}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Custom color"
                  title="Custom color"
                  className="h-7 w-7 shrink-0 cursor-pointer appearance-none rounded-full border border-black/10 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
                />
                <span
                  className="ml-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ background: color }}
                  aria-hidden
                >
                  {name.trim() || "Status name"}
                </span>
              </div>
            </Field>
          </div>
          {error ? <div className="sm:col-span-2"><FormError message={error} /></div> : null}
          <div className="form-actions sm:col-span-2"><Button type="button" variant="secondary" onClick={() => { setError(null); setShowForm(false); }}>Cancel</Button><Button type="submit" variant="primary" icon="plus" loading={busy}>
            Add status
          </Button></div>
        </form>
        </SetupFormModal>
      ) : null}
      {/* Lifecycle statuses as swatch-led entity rows — color-first, with
          usage counts and category chips instead of a flat grid. */}
      <div className="card overflow-hidden">
        <EntityList
          label="Statuses"
          loading={loading}
          skeleton={Array.from({ length: 5 }).map((_, index) => (
            <li key={index} className="flex items-center gap-4 px-4 py-3.5">
              <span className="size-9 animate-pulse rounded-lg bg-muted" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-36 animate-pulse rounded bg-muted" />
                <span className="block h-2.5 w-24 animate-pulse rounded bg-muted" />
              </span>
              <span className="hidden h-3 w-16 animate-pulse rounded bg-muted sm:block" />
            </li>
          ))}
          items={rows.map((row) => ({
            id: row.id,
            leading: row.color ? (
              <span
                className="flex size-9 items-center justify-center rounded-lg border border-black/5"
                style={{ background: `${row.color}1f` }}
                aria-hidden
              >
                <span className="size-3.5 rounded-full border border-black/10" style={{ background: row.color }} />
              </span>
            ) : undefined,
            title: row.name,
            badges: [
              { label: row.appliesTo.toLowerCase(), tone: "info" as const },
              { label: row.category.toLowerCase(), tone: row.category === "OPEN" ? ("neutral" as const) : row.category === "CONVERTED" ? ("success" as const) : row.category === "LOST" ? ("warning" as const) : ("error" as const) },
              ...(row.isDefault ? [{ label: "Default", tone: "success" as const }] : []),
            ],
            meta: [
              { label: "In use", value: (row._count.leads + row._count.contacts + row._count.customers).toLocaleString() },
              { label: "Order", value: row.sortOrder },
            ],
            trailing: canManage ? (
              <RowActions
                actions={[
                  ...(!row.isDefault
                    ? [{ label: "Make default", icon: "check", onClick: () => void makeDefault(row.id) }]
                    : []),
                  { label: "Delete", icon: "trash", destructive: true, onClick: () => void remove(row.id) },
                ]}
              />
            ) : undefined,
          }))}
          empty={<EmptyState icon="sliders" title="No statuses yet" description="Add the lifecycle stages your team works with." className="py-8" />}
        />
      </div>

      {confirmDialog}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between bg-muted px-4 py-3"><div><h2 className="text-sm font-semibold">Potential status</h2><p className="mt-0.5 text-xs text-(--text-tertiary)">Segment leads by commercial potential: Junior, Senior, Institutional, or VIP.</p></div>{canManage ? <Button variant="secondary" icon="plus" onClick={() => setShowPotentialForm(true)}>Add potential status</Button> : null}</div>
        {showPotentialForm && canManage ? <SetupFormModal title="Add potential status" onClose={() => { setError(null); setShowPotentialForm(false); }}><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setError(null); setPotentialBusy(true); try { const response = await fetch("/api/potential-statuses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: potentialName, sortOrder: potentialRows.length + 1 }) }); if (!response.ok) { setError("Could not create potential status."); return; } toast.success("Potential status created"); setPotentialName(""); setShowPotentialForm(false); void load(); } finally { setPotentialBusy(false); } }}><div><p className="form-section-title">Potential status</p><p className="form-section-help">Segment leads by commercial weight for prioritization and filtering.</p></div><Field label="Name" required id="potential-name" help="Ranks a lead's commercial weight — e.g. Junior, Senior, VIP."><IconInput id="potential-name" icon="tag" value={potentialName} onChange={(event) => setPotentialName(event.target.value)} required placeholder="e.g. VIP" /></Field><FormError message={error} /><div className="form-actions"><Button type="button" variant="secondary" onClick={() => { setError(null); setShowPotentialForm(false); }}>Cancel</Button><Button type="submit" variant="primary" icon="plus" loading={potentialBusy}>Add status</Button></div></form></SetupFormModal> : null}
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
                <Button variant="tertiary" size="sm" onClick={async () => { const response = await fetch(`/api/potential-statuses/${status.id}`, { method: "DELETE" }); if (!response.ok) setError("Potential status is in use or could not be deleted."); else { toast.success("Potential status deleted"); void load(); } }} className="size-7 shrink-0 gap-0 px-0" aria-label={`Delete ${status.name}`} title={`Delete ${status.name}`}>
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

const TAG_COLOR_PRESETS = [
  { name: "Slate", value: "#64748b" },
  { name: "Green", value: "#16a34a" },
  { name: "Teal", value: "#0d9488" },
  { name: "Blue", value: "#2563eb" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Pink", value: "#db2777" },
  { name: "Amber", value: "#d97706" },
  { name: "Red", value: "#dc2626" },
] as const;

export function TagsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; color: string | null; _count: { links: number } }>>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#71717a");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    try {
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
      setShowForm(false);
      setName("");
      toast.success("Tag created", { description: `${name} is ready to use on records.` });
      void load();
    } finally {
      setBusy(false);
    }
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
    toast.success("Tag deleted");
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Data model"
        title="Tags" titleIcon="tag"
        subtitle="Create lightweight labels that help teams segment and scan records."
        actions={canManage ? <Button variant="primary" icon="plus" onClick={() => { setError(null); setShowForm(true); }}>Add tag</Button> : undefined}
        metrics={[{ label: "Tags", value: rows.length, tone: "brand" }, { label: "Applied", value: rows.reduce((sum, row) => sum + row._count.links, 0), tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add tag" onClose={() => { setError(null); setShowForm(false); }}>
        <form method="post" onSubmit={create} className="space-y-5">
          <div>
            <p className="form-section-title">Record label</p>
            <p className="form-section-help">Tags segment and prioritize records — they show as colored chips everywhere the record appears.</p>
          </div>
          <Field label="Name" required id="t-name">
            <IconInput id="t-name" icon="tag" value={name} onChange={(e) => setName(e.target.value)} required maxLength={32} placeholder="e.g. High-touch" />
          </Field>
          <Field label="Color" id="t-color">
            <div className="flex flex-wrap items-center gap-2">
              {TAG_COLOR_PRESETS.map((preset) => {
                const selected = color.toLowerCase() === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    aria-label={`Color: ${preset.name}`}
                    aria-pressed={selected}
                    onClick={() => setColor(preset.value)}
                    className={`size-7 shrink-0 rounded-full border border-black/10 transition-transform hover:scale-110 ${selected ? "ring-2 ring-ring ring-offset-2 ring-offset-popover" : ""}`}
                    style={{ background: preset.value }}
                  />
                );
              })}
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Custom color"
                title="Custom color"
                className="h-7 w-7 shrink-0 cursor-pointer appearance-none rounded-full border border-black/10 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
              />
            </div>
          </Field>
          <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-(--text-tertiary)">Preview on a record</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: color }}>
                {name.trim() || "Tag name"}
              </span>
              <span className="text-xs text-(--text-tertiary)">— exactly how the chip reads on records</span>
            </div>
          </div>
          {error ? <FormError message={error} /> : null}
          <div className="form-actions"><Button type="button" variant="secondary" onClick={() => { setError(null); setShowForm(false); }}>Cancel</Button><Button type="submit" variant="primary" icon="plus" loading={busy}>
            Add tag
          </Button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-1 bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Tag library</h2>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">Use consistent labels to make records easier to filter and prioritize.</p>
          </div>
          {rows.length > 0 ? <Badge variant="outline">{rows.length} labels</Badge> : null}
        </div>
        {loading ? (
          <div className="p-3"><AdminCardGridSkeleton cards={6} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon="tag" title="No tags yet" description="Create your first label to start segmenting records." className="py-8" />
        ) : (
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className="flex-row items-center gap-3 p-4 transition-colors hover:bg-muted">
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
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    try {
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
      setShowForm(false);
      setKey("");
      setLabel("");
      setOptions("");
      toast.success("Custom field created", { description: `${label} appears on record forms now.` });
      void load();
    } finally {
      setBusy(false);
    }
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
    toast.success("Field deleted");
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Data model"
        title="Custom fields" titleIcon="list"
        subtitle="Add the business-specific details your team needs on each record."
        actions={canManage ? <Button variant="primary" icon="plus" onClick={() => { setError(null); setShowForm(true); }}>Add field</Button> : undefined}
        metrics={[{ label: "Fields", value: rows.length, tone: "brand" }, { label: "Active", value: rows.filter((row) => row.active).length, tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add custom field" onClose={() => { setError(null); setShowForm(false); }} size="lg">
        <form method="post" onSubmit={create} className="space-y-4">
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
          {error ? <FormError message={error} /> : null}
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => { setError(null); setShowForm(false); }}>Cancel</Button>
            <Button type="submit" variant="primary" icon="plus" loading={busy}>Add field</Button>
          </div>
        </form>
        </SetupFormModal>
      ) : null}
      {/* Custom fields as type-led entity rows — label + key subtitle, type
          and state chips, option previews inline. */}
      <div className="card overflow-hidden">
        <EntityList
          label="Custom fields"
          loading={loading}
          skeleton={Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className="flex items-center gap-4 px-4 py-3.5">
              <span className="size-9 animate-pulse rounded-lg bg-muted" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-40 animate-pulse rounded bg-muted" />
                <span className="block h-2.5 w-48 animate-pulse rounded bg-muted" />
              </span>
              <span className="hidden h-3 w-20 animate-pulse rounded bg-muted sm:block" />
            </li>
          ))}
          items={rows.map((row) => ({
            id: row.id,
            leading: (
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                <Icon name="grid" size={15} />
              </span>
            ),
            title: row.label,
            subtitle: (
              <span className="font-mono text-[11px]">
                {row.key} <span className="text-muted-foreground/60">·</span> {row.objectType.toLowerCase()}
              </span>
            ),
            badges: [
              { label: row.fieldType.replaceAll("_", " ").toLowerCase(), tone: "info" as const },
              { label: row.active ? "active" : "hidden", tone: row.active ? ("success" as const) : ("neutral" as const) },
            ],
            meta: row.options && row.options.length > 0 ? [
              {
                label: "Options",
                value: (
                  <span className="flex flex-wrap gap-1">
                    {row.options.slice(0, 3).map((option) => <Badge key={option} variant="outline">{option}</Badge>)}
                    {row.options.length > 3 ? <span className="self-center text-xs text-muted-foreground">+{row.options.length - 3}</span> : null}
                  </span>
                ),
              },
            ] : [{ label: "Options", value: "—" }],
            trailing: canManage ? (
              <RowActions
                actions={[
                  { label: "Delete", icon: "trash", destructive: true, onClick: () => void remove(row.id) },
                ]}
              />
            ) : undefined,
          }))}
          empty={<EmptyState icon="list" title="No custom fields defined" description="Add a field above to capture business-specific details on records." className="py-6" />}
        />
      </div>

      {confirmDialog}
    </div>
  );
}

export function PeopleTab({ canManage }: { canManage: boolean }) {
  const branding = useCrmBranding();
  // The profile drawer's tab persists for the browser session: an admin
  // auditing users reopens the drawer on the tab they work from, and the
  // choice survives refreshes. "smtp" only validates for managers.
  const [profileDrawerTab, setProfileDrawerTab] = useTabSession(
    "admin:people-drawer",
    "profile",
    (value) => value === "profile" || value === "workspace" || value === "activity" || (canManage && value === "smtp"),
  );
  // Team presence: green dot beside users who are online right now.
  const { online: onlineUsers } = usePresence();
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
  const [userBusy, setUserBusy] = useState(false);
  const [teamBusy, setTeamBusy] = useState(false);
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
    setUserBusy(true);
    try {
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
      toast.success("User created", { description: `${uEmail} can now sign in.` });
      void load();
    } finally {
      setUserBusy(false);
    }
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
      toast.error("Update failed", { description: body?.error ?? "Try again." });
      return;
    }
    toast.success("User updated");
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
    toast.success("Users suspended", { description: `${targets.length} user${targets.length === 1 ? "" : "s"} lost access immediately.` });
    setSelectedIds([]);
    void load();
  }

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setTeamBusy(true);
    try {
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
      toast.success("Team created", { description: `${tName} shapes visibility and ownership.` });
      void load();
    } finally {
      setTeamBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      <WorkspaceHeader
        eyebrow="Access management"
        title="Users & teams" titleIcon="users"
        subtitle={`Manage who can work in ${branding.short} and how records are shared.`}
        actions={canManage ? <Button variant="primary" icon="plus" onClick={() => { setError(null); setShowUserForm(true); }}>New user</Button> : undefined}
        metrics={[{ label: "Total users", value: users.length, tone: "brand" }, { label: "Active", value: users.filter((user) => user.status === "ACTIVE").length, tone: "success" }, { label: "Teams", value: teams.length, tone: "info" }, { label: "Roles", value: roles.length, tone: "warning" }]}
      />
      {showUserForm && canManage ? (
        <SetupFormModal title="New user" onClose={() => { setError(null); setShowUserForm(false); }}>
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
          {error ? <div className="sm:col-span-2"><FormError message={error} /></div> : null}
          <div className="form-actions sm:col-span-2"><Button type="button" variant="secondary" onClick={() => { setError(null); setShowUserForm(false); }}>Cancel</Button><Button type="submit" variant="primary" icon="plus" loading={userBusy}>Create user</Button></div>
        </form>
        </SetupFormModal>
      ) : null}
      {/* People — presented as a premium entity list (avatar, status chips,
          key/values) instead of a raw grid table; zones reflow on phones
          instead of scrolling sideways. */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 bg-muted px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold">People</h3>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">Roles, access, and activity across your workspace</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="people-search" className="sr-only">Search users</label>
            <SearchInput id="people-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, roles, teams" wrapperClassName="w-full sm:w-64" />
            <div role="group" aria-label="Filter by status" className="flex rounded-md border border-input p-0.5">
              {(["ALL", "ACTIVE", "SUSPENDED", "DISABLED"] as const).map((value) => {
                const label = value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase();
                const active = statusFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(value)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
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
        {canManage && selectedIds.length > 0 ? <div className="flex items-center justify-between bg-muted px-4 py-2 text-sm"><span>{selectedIds.length} selected</span><Button variant="destructive" size="sm" icon="x_circle" onClick={() => void suspendSelected()}>Suspend selected</Button></div> : null}
        <EntityList
          label="Users"
          loading={loading}
          skeleton={Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className="flex items-center gap-4 px-4 py-3.5">
              <span className="size-9 animate-pulse rounded-full bg-muted" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-40 animate-pulse rounded bg-muted" />
                <span className="block h-2.5 w-56 animate-pulse rounded bg-muted" />
              </span>
              <span className="hidden h-3 w-24 animate-pulse rounded bg-muted sm:block" />
            </li>
          ))}
          empty={<EmptyState icon="users" title="No users match this view" description="Adjust the search or status filter." className="py-8" />}
          items={filteredUsers.map((user) => {
            const ownedRecords =
              user._count.assignedLeads + user._count.ownedContacts + user._count.ownedAccounts +
              user._count.ownedCustomers + user._count.ownedOpps + user._count.ownedTasks;
            const teamNames = user.memberships.map((membership) => membership.team.name);
            const status = user.status.charAt(0) + user.status.slice(1).toLowerCase();
            return {
              id: user.id,
              onClick: () => setSelectedUserId(user.id),
              selected: selectedUserId === user.id,
              leading: (
                <span className="flex items-center gap-2.5">
                  {canManage ? (
                    <span onClick={(event) => event.stopPropagation()}>
                      <Checkbox aria-label={`Select ${user.name}`} checked={selectedIds.includes(user.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...current, user.id] : current.filter((id) => id !== user.id))} />
                    </span>
                  ) : null}
                  <span className="relative">
                    <Initials name={user.name} size="md" />
                    <span className="absolute -right-0.5 -top-0.5"><PresenceDot online={onlineUsers.has(user.id)} title={`${user.name} is online`} /></span>
                  </span>
                </span>
              ),
              title: user.name,
              subtitle: user.email,
              badges: [
                {
                  label: status,
                  tone: user.status === "ACTIVE" ? "success" : user.status === "SUSPENDED" ? "warning" : "neutral",
                  dot: user.status === "ACTIVE" ? "var(--success)" : user.status === "SUSPENDED" ? "var(--warning)" : undefined,
                },
                { label: user.role.name, tone: "neutral" },
              ],
              meta: [
                {
                  label: "Teams",
                  value: teamNames.length > 0 ? (
                    <span className="flex flex-nowrap items-center gap-1">
                      <Badge variant="outline">{teamNames[0]}</Badge>
                      {teamNames.length > 1 ? <span className="text-xs text-muted-foreground">+{teamNames.length - 1}</span> : null}
                    </span>
                  ) : "—",
                },
                { label: "Last login", value: user.lastLoginAt ? relativeTime(user.lastLoginAt) : "Never" },
                { label: "Records", value: ownedRecords > 0 ? ownedRecords.toLocaleString() : "—" },
              ],
              trailing: canManage ? (
                <>
                  <Select value={user.role.key} onValueChange={(value) => void patchUser(user.id, { roleKey: value })}>
                    <SelectTrigger aria-label={`Role for ${user.name}`} size="sm" className="h-7 w-32 max-w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                          toast.success("User deleted");
                          void load();
                        },
                      },
                    ]}
                  />
                </>
              ) : undefined,
            };
          })}
        />
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
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${selectedUser.status === "ACTIVE" ? "bg-(--success-bg) text-(--success)" : selectedUser.status === "SUSPENDED" ? "bg-(--warning-bg) text-(--warning)" : "bg-muted text-muted-foreground"}`}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${selectedUser.status === "ACTIVE" ? "bg-(--success)" : selectedUser.status === "SUSPENDED" ? "bg-(--warning)" : "bg-(--text-tertiary)"}`} />
              {selectedUser.status.charAt(0) + selectedUser.status.slice(1).toLowerCase()}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{selectedUser.role.name} role</span>
            <span className="text-xs text-(--text-tertiary)">
              Last login {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "never"}
            </span>
          </div>

          <Tabs key={selectedUser.id} value={profileDrawerTab} onValueChange={setProfileDrawerTab} className="mt-4">
            <TabsList variant="line">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="workspace">Workspace</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              {canManage ? <TabsTrigger value="smtp">SMTP access</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="profile" className="mt-4 space-y-5">
              <div className="flex items-center gap-3">
                <Initials name={selectedUser.name} size="md" />
                <div className="min-w-0">
                  <CardLabel>Access</CardLabel>
                  <p className="mt-0.5 text-sm text-muted-foreground">
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
              <div className="border-t border-border pt-4">
                <CardLabel>Team assignments</CardLabel>
                <p className="mt-1 text-sm">{selectedUser.memberships.map((membership) => membership.team.name).join(", ") || "No teams assigned"}</p>
              </div>
            </TabsContent>

            <TabsContent value="workspace" className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href={`/emails?userId=${selectedUser.id}&userName=${encodeURIComponent(selectedUser.name)}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"><Icon name="mail" size={16} className="text-(--text-tertiary)" /><span className="text-sm font-medium">Mailbox</span></Link>
                <Link href={`/leads?assignment=user:${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"><Icon name="target" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.assignedLeads}</span><span className="block text-xs text-muted-foreground">Leads</span></span></Link>
                <Link href={`/contacts?ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"><Icon name="users" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedContacts}</span><span className="block text-xs text-muted-foreground">Contacts</span></span></Link>
                <Link href={`/accounts?ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"><Icon name="building" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedAccounts}</span><span className="block text-xs text-muted-foreground">Accounts</span></span></Link>
                <Link href={`/customers?ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"><Icon name="heart" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedCustomers}</span><span className="block text-xs text-muted-foreground">Customers</span></span></Link>
                <Link href={`/opportunities?ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"><Icon name="trending" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedOpps}</span><span className="block text-xs text-muted-foreground">Opportunities</span></span></Link>
                <Link href={`/tasks?mine=0&ownerUserId=${selectedUser.id}`} className="flex items-center gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"><Icon name="check" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedTasks}</span><span className="block text-xs text-muted-foreground">Tasks</span></span></Link>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <CardLabel>Recent activity</CardLabel>
                <span className="text-[11px] text-(--text-tertiary)">{userActivity.length} events</span>
              </div>
              {activityError ? <p role="alert" className="mt-2 text-sm text-(--error)">{activityError}</p> : activityLoading ? <div className="mt-2 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div> : userActivity.length === 0 ? <EmptyState icon="clock" title="No recorded activity yet" description="Config and record changes will appear here." className="py-6" /> : <ul className="mt-2 space-y-2">{userActivity.map((event) => <li key={event.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"><span><span className="font-medium">{event.label}</span><span className="ml-2 text-xs text-(--text-tertiary)">{event.objectType.toLowerCase()}</span></span><time className="shrink-0 text-[11px] text-(--text-tertiary)">{new Date(event.createdAt).toLocaleDateString()}</time></li>)}</ul>}
            </TabsContent>

            {canManage ? (
              <TabsContent value="smtp" className="mt-4">
                <UserSmtpPanel userId={selectedUser.id} userEmail={selectedUser.email} />
              </TabsContent>
            ) : null}
          </Tabs>
        </Drawer>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-border pb-3 pt-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardLabel>Structure</CardLabel>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Teams <span className="text-sm font-normal text-(--text-tertiary)">{teams.length}</span></h3>
        </div>
        {canManage ? (
          <Button variant="secondary" icon="plus" onClick={() => { setError(null); setShowTeamForm((p) => !p); }}>
            New team
          </Button>
        ) : null}
      </div>
      {showTeamForm && canManage ? (
        <SetupFormModal title="New team" onClose={() => { setError(null); setShowTeamForm(false); }}>
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
          {error ? <FormError message={error} /> : null}
          <div className="form-actions"><Button type="button" variant="secondary" onClick={() => { setError(null); setShowTeamForm(false); }}>Cancel</Button><Button type="submit" variant="primary" icon="plus" loading={teamBusy}>Create team</Button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {loading ? (
          <AdminCardGridSkeleton cards={4} />
        ) : teams.map((team) => (
          <Card key={team.id} className="gap-0 p-4 text-sm transition-colors hover:bg-muted">
            <div className="mb-2 flex items-center justify-between gap-2"><p className="font-semibold">{team.name}</p><Badge variant="outline">{team.memberships.length} members</Badge></div>
            <p className="text-xs text-muted-foreground">Lead: {team.leader?.name ?? "Unassigned"}{team.parent ? <span className="text-(--text-tertiary)"> · under {team.parent.name}</span> : null}</p>
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
                  toast.success("Team deleted");
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
      toast.error("Permission not updated", { description: body?.error ?? "Try again." });
      return;
    }
    setError(null);
    toast.success(enabled ? "Permission granted" : "Permission revoked");
    void load();
  }

  async function setCategory(roleId: string, permissions: readonly { key: string }[], enabled: boolean) {
    const role = roles.find((entry) => entry.id === roleId);
    if (!role || role.key === "SUPER_ADMIN") return;
    const current = new Set(role.permissions.map((entry) => entry.permission));
    permissions.forEach(({ key }) => enabled ? current.add(key) : current.delete(key));
    const response = await fetch(`/api/admin/roles?id=${roleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions: [...current] }) });
    if (!response.ok) setError("Update failed."); else { toast.success("Permissions updated"); void load(); }
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
        title="Roles & permissions" titleIcon="shield"
        subtitle={`Control what each team role can see and do across ${branding.short}.`}
        metrics={[{ label: "Roles", value: roles.length, tone: "brand" }, { label: "Categories", value: PERMISSION_CATEGORIES.length, tone: "info" }, { label: "Assigned users", value: roles.reduce((sum, role) => sum + role._count.users, 0), tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {loading ? (
        <AdminCardGridSkeleton cards={3} />
      ) : selectedRole ? <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 bg-muted px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div><Label htmlFor="role-select">Role</Label><Select value={selectedRole.id} onValueChange={setSelectedRoleId}><IconSelectTrigger id="role-select" icon="shield" className="mt-1 min-w-56 w-full font-semibold sm:w-56"><SelectValue /></IconSelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select><p className="mt-2 text-xs text-muted-foreground">{selectedRole.description} · {selectedRole._count.users} assigned users · {selectedRole.scope.toLowerCase()} scope</p></div>
          <div className="w-full sm:w-64"><label htmlFor="permission-search" className="sr-only">Search permissions</label><SearchInput id="permission-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search permissions" /></div>
        </div>
        <Accordion type="multiple" value={expanded} onValueChange={setExpanded} className="divide-y divide-(--border-default)">
          {visibleCategories.map((category) => {
            const enabledCount = category.permissions.filter(({ key }) => selectedRole.permissions.some((entry) => entry.permission === key)).length;
            const locked = selectedRole.key === "SUPER_ADMIN" || !canManage;
            return (
              <AccordionItem key={category.key} value={category.key} className="border-b-0">
                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
                  <AccordionTrigger className="gap-2 py-0 text-sm font-medium hover:no-underline">
                    {category.label}
                  </AccordionTrigger>
                  <Badge variant="outline" className="shrink-0">{enabledCount} / {category.permissions.length} enabled</Badge>
                  <Button type="button" variant="tertiary" size="sm" icon="check" disabled={locked} onClick={() => void setCategory(selectedRole.id, category.permissions, true)} className="shrink-0">Enable all</Button>
                  <Button type="button" variant="tertiary" size="sm" icon="close" disabled={locked} onClick={() => void setCategory(selectedRole.id, category.permissions, false)} className="shrink-0">Disable all</Button>
                </div>
                <AccordionContent className="pb-0">
                  <div className="grid gap-1 border-t border-border bg-card px-2 py-2 sm:grid-cols-2 lg:grid-cols-3">
                    {category.permissions.map(({ key, label }) => {
                      const enabled = selectedRole.permissions.some((entry) => entry.permission === key);
                      return (
                        <label key={key} htmlFor={`perm-${selectedRole.id}-${key}`} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer ${enabled ? "bg-muted text-foreground" : "text-(--text-tertiary)"}`}>
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
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
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
      setShowForm(false);
      setKey(""); setValue("");
      toast.success("Setting saved", { description: `${key} applied across the workspace.` });
      void load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Workspace behavior"
        title="Settings" titleIcon="settings"
        subtitle={`Manage organization-level defaults used throughout ${branding.short}.`}
        actions={<Button variant="primary" icon="plus" onClick={() => { setError(null); setShowForm(true); }}>Add setting</Button>}
        metrics={[{ label: "Configured", value: settings.length, tone: "brand" }, { label: "Storage", value: "Workspace", tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm ? <SetupFormModal title="Add workspace setting" onClose={() => { setError(null); setShowForm(false); }}>
      <form method="post" onSubmit={save} className="space-y-4">
        <div><p className="form-section-title">Workspace default</p><p className="form-section-help">Use a namespaced key such as org.currency or tasks.defaultDueDays.</p></div>
        <Field label="Key" required id="set-key" help="Lowercase, dot-namespaced.">
          <IconInput id="set-key" icon="tag" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9_.]*" placeholder="e.g. org.currency" />
        </Field>
        <Field label="Value" required id="set-value" help="JSON, number, or string.">
          <IconInput id="set-value" icon="sliders" value={value} onChange={(e) => setValue(e.target.value)} required placeholder="e.g. EUR" />
        </Field>
        {error ? <FormError message={error} /> : null}
        <div className="form-actions"><Button type="button" variant="secondary" onClick={() => { setError(null); setShowForm(false); }}>Cancel</Button><Button type="submit" variant="primary" icon="plus" loading={busy}>Save setting</Button></div>
      </form>
      </SetupFormModal> : null}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-muted px-4 py-3">
          <h2 className="text-sm font-semibold">Configured values</h2>
          <p className="mt-0.5 text-xs text-(--text-tertiary)">Changes are applied across the workspace.</p>
        </div>
        {loading ? (
          <div className="p-4">
            {[...Array(4)].map((_, index) => (
              <div key={`settings-skeleton-${index}`} className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
                <Skeleton style={{ height: 14, width: "35%" }} />
                <Skeleton style={{ height: 14, width: "22%" }} />
              </div>
            ))}
          </div>
        ) : settings.length === 0 ? (
          <EmptyState icon="settings" title="No settings yet" description="Add a workspace default above to make it available to the CRM." className="py-6" />
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
        title="Audit log" titleIcon="clock"
        subtitle="Review configuration and record changes across your workspace."
        metrics={[{ label: "Entries", value: total, tone: "brand" }, { label: "Page", value: page, tone: "info" }, { label: "Page size", value: pageSize, tone: "success" }]}
      />
      {/* Activity timeline — actor-led story lines instead of a grid: who
          did what, to which object, when. Same data, read like a feed. */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between bg-muted px-4 py-3">
          <div><h2 className="text-sm font-semibold">Recent activity</h2><p className="mt-0.5 text-xs text-(--text-tertiary)">Append-only history of important changes.</p></div>
          <Badge className="badge badge-neutral">{total} entries</Badge>
        </div>
        <ol aria-label="Audit timeline" className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <li key={index} className="flex items-center gap-3.5 px-4 py-3">
                <span className="size-8 animate-pulse rounded-full bg-muted" />
                <span className="flex-1 space-y-1.5">
                  <span className="block h-3 w-56 animate-pulse rounded bg-muted" />
                  <span className="block h-2.5 w-32 animate-pulse rounded bg-muted" />
                </span>
                <span className="hidden h-2.5 w-20 animate-pulse rounded bg-muted sm:block" />
              </li>
            ))
          ) : entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/40">
              {entry.actor?.name ? (
                <Initials name={entry.actor.name} size="sm" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
                  <Icon name="settings" size={13} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug">
                  <span className="font-medium text-foreground">{entry.actor?.name ?? "System"}</span>{" "}
                  <span className="text-muted-foreground">{entry.action.replaceAll("_", " ").toLowerCase()}</span>{" "}
                  <Badge variant="outline">{entry.objectType.toLowerCase()}</Badge>
                  {entry.objectId ? <span className="ml-1 font-mono text-[10px] text-muted-foreground/70">…{entry.objectId.slice(-6)}</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground" title={new Date(entry.createdAt).toLocaleString()}>
                  {relativeTime(entry.createdAt)}
                </p>
              </div>
              <time className="hidden shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground sm:block" dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}
              </time>
            </li>
          ))}
          {!loading && entries.length === 0 ? (
            <li className="px-4"><EmptyState icon="clock" title="No audit entries yet" description="Configuration and record changes will appear here as they happen." className="py-6" /></li>
          ) : null}
        </ol>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {total > 0 ? (
            <>Showing <strong className="text-foreground">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</strong> of {total}</>
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
        title="Integrations" titleIcon="plug"
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground" aria-hidden>
            <Icon name="plug" size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-medium">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className={enabled ? badgeToneClass("success") : undefined}>{enabled ? "Connected" : "Not configured"}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-(--text-tertiary)"><span aria-hidden className={`h-2 w-2 rounded-full ${enabled ? "bg-(--success)" : "bg-(--text-tertiary)"}`} />{detail}</div>
    </Card>
  );
}


const FIELD_TYPE_OPTIONS = ["TEXT", "NUMBER", "CURRENCY", "BOOLEAN", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "PHONE", "EMAIL", "URL"] as const;

type ObjectFieldDraft = { id: number; label: string; type: string; required: boolean; options: string };

let fieldRowSeq = 0;
const emptyFieldRow = (): ObjectFieldDraft => ({ id: ++fieldRowSeq, label: "", type: "TEXT", required: false, options: "" });

function fieldKeyFromLabel(label: string): string {
  const parts = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "field";
  const key = parts[0] + parts.slice(1).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  return /^[a-z]/.test(key) ? key : `f${key}`;
}

function uniqueFieldKeys(rows: ObjectFieldDraft[]): string[] {
  const used = new Set<string>();
  return rows.map((row) => {
    const base = fieldKeyFromLabel(row.label);
    let key = base;
    let suffix = 2;
    while (used.has(key)) key = `${base}_${suffix++}`;
    used.add(key);
    return key;
  });
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
  const [fieldRows, setFieldRows] = useState<ObjectFieldDraft[]>([emptyFieldRow()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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

  function updateFieldRow(id: number, patch: Partial<ObjectFieldDraft>) {
    setFieldRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (fieldRows.some((row) => !row.label.trim())) {
      setError("Every field needs a label.");
      return;
    }
    const missingOptions = fieldRows.find(
      (row) => (row.type === "SELECT" || row.type === "MULTI_SELECT") && !row.options.split(",").some((entry) => entry.trim())
    );
    if (missingOptions) {
      setError(`"${missingOptions.label.trim()}" needs at least one option.`);
      return;
    }
    const keys = uniqueFieldKeys(fieldRows);
    const fields = fieldRows.map((row, index) => ({
      key: keys[index],
      label: row.label.trim(),
      type: row.type,
      required: row.required,
      sortOrder: index + 1,
      ...(row.type === "SELECT" || row.type === "MULTI_SELECT"
        ? { options: row.options.split(",").map((entry) => entry.trim()).filter(Boolean) }
        : {}),
    }));
    setBusy(true);
    try {
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
      setFieldRows([emptyFieldRow()]);
      toast.success("Object created", { description: `${pluralName} is live with ${fieldRows.length} field${fieldRows.length === 1 ? "" : "s"}.` });
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/admin/objects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    toast.success(active ? "Object activated" : "Object deactivated");
    void load();
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Data model"
        title="Custom objects" titleIcon="box"
        subtitle={`Extend ${branding.short} with record types that match how your business works.`}
        actions={<Button variant="primary" icon="plus" onClick={() => { setError(null); setFieldRows([emptyFieldRow()]); setShowForm(true); }}>New object type</Button>}
        metrics={[{ label: "Object types", value: objects.length, tone: "brand" }, { label: "Active", value: objects.filter((object) => object.active).length, tone: "success" }, { label: "Records", value: objects.reduce((sum, object) => sum + object._count.records, 0), tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      <div className="rounded-lg border border-(--info-border) bg-(--info-bg) px-4 py-3 text-sm text-(--info)">
        <p>
          Admin-defined record types (e.g. Properties, Vendors, Deals) — records are JSONB documents validated against each object&#39;s field schema.
        </p>
      </div>

      {showForm ? (
        <SetupFormModal title="New custom object" onClose={() => { setError(null); setShowForm(false); }} size="lg">
        <form method="post" onSubmit={create} className="space-y-4">
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
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <p className="text-sm font-medium">Fields <span className="font-normal text-(--text-tertiary)">({fieldRows.length})</span></p>
              <p className="text-xs text-(--text-tertiary)">Keys are generated from labels — used in imports and the API.</p>
            </div>
            {fieldRows.map((row, index) => (
              <div key={row.id} className="space-y-2 rounded-lg border border-border bg-muted p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={row.label}
                    onChange={(e) => updateFieldRow(row.id, { label: e.target.value })}
                    placeholder={`Field ${index + 1} label — e.g. Price`}
                    aria-label={`Field ${index + 1} label`}
                    maxLength={80}
                    className="h-8 min-w-0 flex-1"
                  />
                  <Select value={row.type} onValueChange={(value) => updateFieldRow(row.id, { type: value })}>
                    <SelectTrigger size="sm" aria-label={`Field ${index + 1} type`} className="h-8 w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>{type.replaceAll("_", " ").toLowerCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={row.required} onCheckedChange={(checked) => updateFieldRow(row.id, { required: checked === true })} aria-label={`Field ${index + 1} required`} />
                    Required
                  </label>
                  <Button
                    type="button" variant="tertiary" size="sm" className="size-7 shrink-0 gap-0 px-0"
                    aria-label={`Remove field ${index + 1}`} title="Remove field"
                    disabled={fieldRows.length === 1}
                    onClick={() => setFieldRows((rows) => rows.filter((entry) => entry.id !== row.id))}
                  >
                    <Icon name="close" size={14} />
                  </Button>
                </div>
                {row.type === "SELECT" || row.type === "MULTI_SELECT" ? (
                  <Input
                    value={row.options}
                    onChange={(e) => updateFieldRow(row.id, { options: e.target.value })}
                    placeholder="Options, comma separated — e.g. New, Active, Archived"
                    aria-label={`Field ${index + 1} options`}
                    className="h-8"
                  />
                ) : null}
              </div>
            ))}
            <Button
              type="button" variant="secondary" size="sm" icon="plus" className="w-full border-dashed"
              disabled={fieldRows.length >= 50}
              onClick={() => setFieldRows((rows) => [...rows, emptyFieldRow()])}
            >
              Add field
            </Button>
          </div>
          {error ? <FormError message={error} /> : null}
          <div className="form-actions"><Button type="button" variant="secondary" onClick={() => { setError(null); setShowForm(false); }}>Cancel</Button><Button type="submit" variant="primary" icon="plus" loading={busy}>Create object</Button></div>
        </form>
        </SetupFormModal>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {loading ? (
          <AdminCardGridSkeleton cards={4} />
        ) : objects.map((object) => (
          <Card key={object.id} className="gap-0 p-4 transition-colors hover:bg-muted">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-medium">
                  {object.pluralName}
                  <span className="ml-2 font-mono text-xs text-(--text-tertiary)">/{object.key}</span>
                </p>
                {object.description ? <p className="text-xs text-muted-foreground">{object.description}</p> : null}
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
                      toast.success("Object deleted");
                      void load();
                    }}
                    className="text-(--error) hover:underline"
                  >
                    delete
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 border-t border-border pt-3 text-xs text-(--text-tertiary)">
              {object.fields?.map((field) => field.label).join(", ") || "No fields defined"}
            </div>
          </Card>
        ))}
        {!loading && objects.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState icon="box" title="No custom objects yet" description="Create one above — e.g. Properties or Vendors." className="py-8" />
          </Card>
        ) : null}
      </div>

      {confirmDialog}
    </div>
  );
}
