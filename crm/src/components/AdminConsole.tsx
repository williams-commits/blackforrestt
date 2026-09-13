"use client";

import { useCrmBranding } from "@/components/BrandingProvider";
import { useCallback, useEffect, useState } from "react";
import { useConfirmDialog } from "@/components/Dialogs";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { Modal } from "@/components/Modal";
import { PERMISSION_CATEGORIES } from "@/server/permissions";

/** Administration console: statuses, tags, custom fields, teams, users, audit. */
export function AdminConsole({
  canManage,
  canAudit,
}: {
  canManage: boolean;
  canAudit: boolean;
}) {
  const [tab, setTab] = useState<"statuses" | "tags" | "fields" | "people" | "roles" | "settings" | "objects" | "integrations" | "audit">("statuses");

  const tabs = [
    { key: "statuses" as const, label: "Statuses" },
    { key: "tags" as const, label: "Tags" },
    { key: "fields" as const, label: "Custom fields" },
    { key: "people" as const, label: "Users & teams" },
    ...(canManage ? [{ key: "roles" as const, label: "Roles" }] : []),
    ...(canManage ? [{ key: "settings" as const, label: "Settings" }] : []),
    ...(canManage ? [{ key: "objects" as const, label: "Custom objects" }] : []),
    ...(canManage ? [{ key: "integrations" as const, label: "Integrations" }] : []),
    ...(canAudit ? [{ key: "audit" as const, label: "Audit log" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Administration</h1>
        <p className="text-sm text-(--text-secondary)">
          {canManage
            ? "Business configuration — changes are audit-logged."
            : "Read-only view — SETTINGS_MANAGE required for changes."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-(--border-default) pb-2">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === entry.key ? "bg-(--brand) text-white" : "border border-(--border-strong) bg-(--bg-surface) hover:bg-(--bg-hover)"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {tab === "statuses" ? <StatusesTab canManage={canManage} /> : null}
      {tab === "tags" ? <TagsTab canManage={canManage} /> : null}
      {tab === "fields" ? <FieldsTab canManage={canManage} /> : null}
      {tab === "people" ? <PeopleTab canManage={canManage} /> : null}
      {tab === "roles" ? <RolesTab /> : null}
      {tab === "settings" ? <SettingsTab /> : null}
      {tab === "objects" ? <ObjectsTab /> : null}
      {tab === "integrations" ? <IntegrationsTab /> : null}
      {tab === "audit" ? <AuditTab /> : null}
    </div>
  );
}

const inputClass = "w-full rounded-md border border-(--border-strong) px-3 py-2 text-sm focus:border-(--brand) focus:outline-none focus:ring-2 focus:ring-(--brand)/20";

function SetupFormModal({ title, onClose, children, size = "md" }: { title: string; onClose: () => void; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  return <Modal title={title} onClose={onClose} size={size}><div className="p-5">{children}</div></Modal>;
}

function AdminTableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {[...Array(rows)].map((_, rowIndex) => (
        <tr key={`admin-skeleton-row-${rowIndex}`}>
          {[...Array(columns)].map((__, columnIndex) => (
            <td key={`admin-skeleton-cell-${rowIndex}-${columnIndex}`} className="px-3 py-3">
              <div
                className="skeleton"
                style={{
                  height: columnIndex === 0 ? 18 : 14,
                  width: `${columnIndex === 0 ? 80 : 58 - (columnIndex % 3) * 8}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function AdminCardGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(cards)].map((_, index) => (
        <div key={`admin-card-skeleton-${index}`} className="card p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="skeleton" style={{ height: 36, width: 36 }} />
            <div className="min-w-0 flex-1">
              <div className="skeleton" style={{ height: 16, width: "70%" }} />
              <div className="skeleton mt-2" style={{ height: 12, width: "45%" }} />
            </div>
          </div>
          <div className="skeleton" style={{ height: 12, width: "90%" }} />
          <div className="skeleton mt-2" style={{ height: 12, width: "60%" }} />
        </div>
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
        actions={canManage ? <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><span aria-hidden>+</span> Add status</button> : undefined}
        metrics={[{ label: "Statuses", value: rows.length, tone: "brand" }, { label: "Objects", value: new Set(rows.map((row) => row.appliesTo)).size, tone: "info" }, { label: "Defaults", value: rows.filter((row) => row.isDefault).length, tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add status" onClose={() => setShowForm(false)}>
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className="form-section-title">Lifecycle status</p><p className="form-section-help">Statuses appear on records and guide your team through the relationship lifecycle.</p></div>
          <div>
            <label htmlFor="s-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass}/>
          </div>
          <div>
            <label htmlFor="s-applies" className="form-label">Applies to</label>
            <select id="s-applies" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className={inputClass}>
              <option value="LEAD">Leads</option>
              <option value="CONTACT">Contacts</option>
              <option value="CUSTOMER">Customers</option>
            </select>
          </div>
          <div>
            <label htmlFor="s-cat" className="form-label">Category</label>
            <select id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="OPEN">Open</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
              <option value="INVALID">Invalid</option>
            </select>
          </div>
          <div className="form-actions sm:col-span-2"><button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">
            <span aria-hidden>+</span> Add status
          </button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr className="border-b border-(--border-default) bg-(--bg-hover) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Object</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">In use</th>
              <th className="px-3 py-2 font-medium">Default</th>
              {canManage ? <th className="px-3 py-2 text-right font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={5} columns={canManage ? 6 : 5} />
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3 font-medium">{row.name}</td>
                <td className="px-3 py-3"><span className="badge badge-neutral">{row.appliesTo.toLowerCase()}</span></td>
                <td className="px-3 py-3"><span className={`badge ${row.category === "OPEN" ? "badge-info" : row.category === "CONVERTED" ? "badge-success" : "badge-warning"}`}>{row.category.toLowerCase()}</span></td>
                <td className="px-3 py-2">{row._count.leads + row._count.contacts + row._count.customers}</td>
                <td className="px-3 py-3">{row.isDefault ? <span className="badge badge-brand">Default</span> : <span className="text-xs text-(--text-tertiary)">—</span>}</td>
                {canManage ? (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {!row.isDefault ? (
                      <button type="button" onClick={() => void makeDefault(row.id)} className="mr-2 text-xs text-(--brand) hover:underline">
                        make default
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void remove(row.id)} className="text-xs text-(--error) hover:underline">
                      delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDialog}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3"><div><h2 className="text-sm font-semibold">Potential status</h2><p className="mt-0.5 text-xs text-(--text-tertiary)">Segment leads by commercial potential: Junior, Senior, Institutional, or VIP.</p></div>{canManage ? <button type="button" onClick={() => setShowPotentialForm(true)} className="btn btn-secondary"><span aria-hidden>+</span> Add potential status</button> : null}</div>
        {showPotentialForm && canManage ? <SetupFormModal title="Add potential status" onClose={() => setShowPotentialForm(false)}><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); const response = await fetch("/api/potential-statuses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: potentialName, sortOrder: potentialRows.length + 1 }) }); if (!response.ok) { setError("Could not create potential status."); return; } setPotentialName(""); setShowPotentialForm(false); void load(); }}><div><label htmlFor="potential-name" className="form-label">Name <span className="form-required">*</span></label><input id="potential-name" value={potentialName} onChange={(event) => setPotentialName(event.target.value)} required className={inputClass} placeholder="VIP" /></div><div className="form-actions"><button type="button" onClick={() => setShowPotentialForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><span aria-hidden>+</span> Add status</button></div></form></SetupFormModal> : null}
        {loading ? <div className="p-3"><AdminCardGridSkeleton cards={4} /></div> : <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">{potentialRows.map((status) => {
          const leadCount = status._count?.leads ?? 0;
          return (
            <div key={status.id} className="flex items-center justify-between rounded-lg border border-(--border-default) px-3 py-3">
              <div>
                <p className="text-sm font-semibold">{status.name}</p>
                <p className="text-xs text-(--text-tertiary)">{leadCount} leads{status.isDefault ? " · default" : ""}</p>
              </div>
              {canManage ? (
                <button type="button" onClick={async () => { const response = await fetch(`/api/potential-statuses/${status.id}`, { method: "DELETE" }); if (!response.ok) setError("Potential status is in use or could not be deleted."); else void load(); }} className="text-xs text-(--error) hover:underline">delete</button>
              ) : null}
            </div>
          );
        })}</div>}
      </section>
    </div>
  );
}

export function TagsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; color: string | null; _count: { links: number } }>>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1f6f43");
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
        actions={canManage ? <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><span aria-hidden>+</span> Add tag</button> : undefined}
        metrics={[{ label: "Tags", value: rows.length, tone: "brand" }, { label: "Applied", value: rows.reduce((sum, row) => sum + row._count.links, 0), tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add tag" onClose={() => setShowForm(false)}>
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="sm:col-span-2"><p className="form-section-title">Record label</p><p className="form-section-help">Use tags for quick segmentation, prioritization, and saved views.</p></div>
          <div>
            <label htmlFor="t-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass}/>
          </div>
          <div>
            <label htmlFor="t-color" className="form-label">Color</label>
            <input
              id="t-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={`${inputClass} h-9 w-14 cursor-pointer p-0.5`}
              aria-label="Tag color"
              title="Choose a tag color"
            />
          </div>
          <div className="form-actions sm:col-span-2"><button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">
            <span aria-hidden>+</span> Add tag
          </button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Tag library</h2>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">Use consistent labels to make records easier to filter and prioritize.</p>
          </div>
          {rows.length > 0 ? <span className="badge badge-neutral">{rows.length} labels</span> : null}
        </div>
        {loading ? (
          <div className="p-3"><AdminCardGridSkeleton cards={6} /></div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p className="empty-state-title">No tags yet</p><p className="empty-state-description">Create your first label to start segmenting records.</p></div>
        ) : (
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="card-interactive flex items-center gap-3 rounded-lg border border-(--border-default) bg-(--bg-surface) px-3 py-3">
              <span className="h-9 w-9 shrink-0 rounded-lg border border-black/10 shadow-inner" style={{ background: row.color ?? "#78716c" }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <p className="mt-0.5 text-xs text-(--text-tertiary)">{row._count.links} {row._count.links === 1 ? "record" : "records"}</p>
              </div>
              {canManage ? (
                <button type="button" onClick={() => void remove(row.id)} className="icon-button h-7 w-7 text-sm" aria-label={`Delete ${row.name}`} title={`Delete ${row.name}`}>
                  ×
                </button>
              ) : null}
            </div>
          ))
          }</div>
        )}
      </section>

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
        actions={canManage ? <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><span aria-hidden>+</span> Add field</button> : undefined}
        metrics={[{ label: "Fields", value: rows.length, tone: "brand" }, { label: "Active", value: rows.filter((row) => row.active).length, tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add custom field" onClose={() => setShowForm(false)} size="lg">
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Add custom field</h3>
            <p className="mt-1 text-xs text-(--text-secondary)">Define a field that can be used on records of the selected object.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="cf-object" className="mb-1 block text-xs font-medium">Object</label>
              <select id="cf-object" value={objectType} onChange={(e) => setObjectType(e.target.value)} className={inputClass} style={{ width: "100%" }}>
              <option value="LEAD">Lead</option>
              <option value="CONTACT">Contact</option>
              <option value="ACCOUNT">Account</option>
              <option value="CUSTOMER">Customer</option>
              </select>
            </div>
            <div>
              <label htmlFor="cf-label" className="mb-1 block text-xs font-medium">Label</label>
              <input id="cf-label" value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="e.g. Customer tier" className={inputClass} style={{ width: "100%" }} />
            </div>
            <div>
              <label htmlFor="cf-key" className="mb-1 block text-xs font-medium">Key</label>
              <input id="cf-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-zA-Z0-9_]*" title="Start with a lowercase letter; use letters, numbers, or underscores." placeholder="e.g. customerTier" className={inputClass} style={{ width: "100%" }} />
              <p className="mt-1 text-xs text-(--text-tertiary)">Lowercase camelCase, letters, numbers, and underscores.</p>
            </div>
            <div>
              <label htmlFor="cf-type" className="mb-1 block text-xs font-medium">Type</label>
              <select id="cf-type" value={fieldType} onChange={(e) => setFieldType(e.target.value)} className={inputClass} style={{ width: "100%" }}>
              {["TEXT", "NUMBER", "CURRENCY", "BOOLEAN", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "PHONE", "EMAIL", "URL"].map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ").toLowerCase()}</option>
              ))}
              </select>
            </div>
          </div>
          {fieldType === "SELECT" || fieldType === "MULTI_SELECT" ? (
            <div>
              <label htmlFor="cf-options" className="mb-1 block text-xs font-medium">Options</label>
              <input id="cf-options" value={options} onChange={(e) => setOptions(e.target.value)} required placeholder="e.g. New, Active, Archived" className={inputClass} style={{ width: "100%" }} />
              <p className="mt-1 text-xs text-(--text-tertiary)">Separate each option with a comma.</p>
            </div>
          ) : null}
          <div className="form-actions">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary"><span aria-hidden>+</span> Add field</button>
          </div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr className="border-b border-(--border-default) bg-(--bg-hover) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
              <th className="px-3 py-2 font-medium">Object</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Options</th>
              <th className="px-3 py-2 font-medium">State</th>
              {canManage ? <th className="px-3 py-2 text-right font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={6} columns={canManage ? 7 : 6} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-(--text-tertiary)">No custom fields defined.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.objectType.toLowerCase()}</td>
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.key}</td>
                  <td className="px-3 py-2">{row.fieldType.replaceAll("_", " ").toLowerCase()}</td>
                  <td className="px-3 py-2 text-xs">{row.options?.join(", ") ?? "—"}</td>
                  <td className="px-3 py-2">{row.active ? "active" : "hidden"}</td>
                  {canManage ? (
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => void remove(row.id)} className="text-xs text-(--error) hover:underline">
                        delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
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
        actions={canManage ? <button type="button" onClick={() => setShowUserForm(true)} className="btn btn-primary"><span aria-hidden>+</span> New user</button> : undefined}
        metrics={[{ label: "Total users", value: users.length, tone: "brand" }, { label: "Active", value: users.filter((user) => user.status === "ACTIVE").length, tone: "success" }, { label: "Teams", value: teams.length, tone: "info" }, { label: "Roles", value: roles.length, tone: "warning" }]}
      />
      {showUserForm && canManage ? (
        <SetupFormModal title="New user" onClose={() => setShowUserForm(false)}>
        <form method="post" onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className="form-section-title">Access profile</p><p className="form-section-help">Create a person, then assign their role and scope.</p></div>
          <div>
            <label htmlFor="au-email" className="form-label">Email <span className="form-required">*</span></label>
            <input id="au-email" type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="au-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="au-name" value={uName} onChange={(e) => setUName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="au-pass" className="form-label">Password <span className="form-required">*</span> (10+)</label>
            <input id="au-pass" type="password" value={uPassword} onChange={(e) => setUPassword(e.target.value)} required minLength={10} className={inputClass} />
          </div>
          <div>
            <label htmlFor="au-role" className="form-label">Role</label>
            <select id="au-role" value={uRole} onChange={(e) => setURole(e.target.value)} className={inputClass}>
              {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
            </select>
          </div>
          <div className="form-actions sm:col-span-2"><button type="button" onClick={() => setShowUserForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><span aria-hidden>+</span> Create user</button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-(--border-default) px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">People</h3>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">Roles and activity across your workspace</p>
          </div>
          <span className="badge badge-neutral">{users.length} users</span>
        </div>
        <table className="table">
          <thead>
            <tr className="border-b border-(--border-default) bg-(--bg-hover) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Teams</th>
              <th className="px-3 py-2 font-medium">Last login</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {canManage ? <th className="px-3 py-2 text-right font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={6} columns={canManage ? 6 : 5} />
            ) : users.map((user) => (
              <tr key={user.id}>
                <td className="px-3 py-3"><div className="flex items-center gap-3"><span className="avatar avatar-sm" style={{ background: "var(--brand-100)", color: "var(--brand-800)" }}>{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><p className="font-medium">{user.name}</p><p className="text-xs text-(--text-tertiary)">{user.email}</p></div></div></td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select aria-label={`Role for ${user.name}`} value={user.role.key} onChange={(e) => void patchUser(user.id, { roleKey: e.target.value })} className={inputClass}>
                      {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                    </select>
                  ) : user.role.name}
                </td>
                <td className="px-3 py-2 text-xs">{user.memberships.map((m) => m.team.name).join(", ") || "—"}</td>
                <td className="px-3 py-2 text-xs">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "never"}</td>
                <td className="px-3 py-2"><span className={user.status === "ACTIVE" ? "badge badge-success" : "badge badge-neutral"}>{user.status.toLowerCase()}</span></td>
                {canManage ? (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => void patchUser(user.id, { status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}
                      className="mr-3 text-xs text-(--text-brand) hover:underline"
                    >
                      {user.status === "ACTIVE" ? "suspend" : "activate"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
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
                      }}
                      className="text-xs text-(--error) hover:underline"
                    >
                      delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-b border-(--border-default) pb-3 pt-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">Structure</p>
          <h3 className="text-lg font-semibold tracking-tight">Teams <span className="text-sm font-normal text-(--text-tertiary)">{teams.length}</span></h3>
        </div>
        {canManage ? (
          <button type="button" onClick={() => setShowTeamForm((p) => !p)} className="btn btn-secondary">
            <span aria-hidden>+</span> New team
          </button>
        ) : null}
      </div>
      {showTeamForm && canManage ? (
        <SetupFormModal title="New team" onClose={() => setShowTeamForm(false)}>
        <form method="post" onSubmit={createTeam} className="space-y-4">
          <div><p className="form-section-title">Team structure</p><p className="form-section-help">Teams shape visibility, ownership, and collaboration.</p></div>
          <div>
            <label htmlFor="at-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="at-name" value={tName} onChange={(e) => setTName(e.target.value)} required minLength={2} className={inputClass} />
          </div>
          <div>
            <label htmlFor="at-leader" className="form-label">Leader</label>
            <select id="at-leader" value={tLeader} onChange={(e) => setTLeader(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div className="form-actions"><button type="button" onClick={() => setShowTeamForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><span aria-hidden>+</span> Create team</button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {loading ? (
          <AdminCardGridSkeleton cards={4} />
        ) : teams.map((team) => (
          <div key={team.id} className="card card-interactive p-4 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2"><p className="font-semibold">{team.name}</p><span className="badge badge-neutral">{team.memberships.length} members</span></div>
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
          </div>
        ))}
      </div>

      {confirmDialog}
    </div>
  );
}

export function RolesTab() {
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
      ) : selectedRole ? <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div><label htmlFor="role-select" className="form-label">Role</label><select id="role-select" value={selectedRole.id} onChange={(event) => setSelectedRoleId(event.target.value)} className="mt-1 min-w-56 rounded-md border border-(--border-strong) bg-(--bg-surface) px-3 py-2 text-sm font-semibold">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><p className="mt-2 text-xs text-(--text-secondary)">{selectedRole.description} · {selectedRole._count.users} assigned users · {selectedRole.scope.toLowerCase()} scope</p></div>
          <div className="relative"><label htmlFor="permission-search" className="sr-only">Search permissions</label><input id="permission-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search permissions" className={inputClass} /></div>
        </div>
        <div className="divide-y divide-(--border-default)">
          {visibleCategories.map((category) => {
            const enabledCount = category.permissions.filter(({ key }) => selectedRole.permissions.some((entry) => entry.permission === key)).length;
            const isExpanded = expanded.includes(category.key);
            const locked = selectedRole.key === "SUPER_ADMIN";
            return <div key={category.key}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-(--bg-hover)">
                <button type="button" aria-expanded={isExpanded} onClick={() => setExpanded((current) => current.includes(category.key) ? current.filter((key) => key !== category.key) : [...current, category.key])} className="w-5 text-left text-(--text-secondary)">{isExpanded ? "▾" : "▸"}</button>
                <button type="button" onClick={() => setExpanded((current) => current.includes(category.key) ? current : [...current, category.key])} className="flex-1 text-left text-sm font-semibold">{category.label}</button>
                <span className="text-xs tabular-nums text-(--text-secondary)">{enabledCount} / {category.permissions.length} enabled</span>
                <button type="button" disabled={locked} onClick={() => void setCategory(selectedRole.id, category.permissions, true)} className="text-xs text-(--brand) disabled:opacity-40">Enable all</button>
                <button type="button" disabled={locked} onClick={() => void setCategory(selectedRole.id, category.permissions, false)} className="text-xs text-(--text-secondary) disabled:opacity-40">Disable all</button>
              </div>
              {isExpanded ? <div className="grid gap-1 border-t border-(--border-default) bg-(--bg-surface) px-12 py-2 sm:grid-cols-2 lg:grid-cols-3">{category.permissions.map(({ key, label }) => { const enabled = selectedRole.permissions.some((entry) => entry.permission === key); return <label key={key} className={`flex items-center gap-2 rounded px-2 py-2 text-sm ${enabled ? "bg-(--bg-subtle) text-(--text-primary)" : "text-(--text-tertiary)"}`}><input type="checkbox" checked={enabled} disabled={locked} onChange={(event) => void toggle(selectedRole.id, key, event.target.checked)} />{label}</label>; })}</div> : null}
            </div>;
          })}
        </div>
      </section> : null}
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
        actions={<button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><span aria-hidden>+</span> Add setting</button>}
        metrics={[{ label: "Configured", value: settings.length, tone: "brand" }, { label: "Storage", value: "Workspace", tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm ? <SetupFormModal title="Add workspace setting" onClose={() => setShowForm(false)}>
      <form method="post" onSubmit={async (event) => { await save(event); setShowForm(false); }} className="space-y-4">
        <div><p className="form-section-title">Workspace default</p><p className="form-section-help">Use a namespaced key such as org.currency or tasks.defaultDueDays.</p></div>
        <div>
          <label htmlFor="set-key" className="mb-1 block text-xs font-medium">Key (e.g. org.currency)</label>
          <input id="set-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9_.]*" className={inputClass} />
        </div>
        <div>
          <label htmlFor="set-value" className="mb-1 block text-xs font-medium">Value</label>
          <input id="set-value" value={value} onChange={(e) => setValue(e.target.value)} required className={inputClass} />
        </div>
        <div className="form-actions"><button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><span aria-hidden>+</span> Save setting</button></div>
      </form>
      </SetupFormModal> : null}
      <div className="card overflow-hidden">
        <div className="border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3">
          <h2 className="text-sm font-semibold">Configured values</h2>
          <p className="mt-0.5 text-xs text-(--text-tertiary)">Changes are applied across the workspace.</p>
        </div>
        {loading ? (
          <div className="p-4">
            {[...Array(4)].map((_, index) => (
              <div key={`settings-skeleton-${index}`} className="flex items-center justify-between gap-4 border-b border-(--border-default) py-3 last:border-0">
                <div className="skeleton" style={{ height: 14, width: "35%" }} />
                <div className="skeleton" style={{ height: 14, width: "22%" }} />
              </div>
            ))}
          </div>
        ) : settings.length === 0 ? (
          <div className="empty-state"><p className="empty-state-title">No settings yet</p><p className="empty-state-description">Add a workspace default above to make it available to the CRM.</p></div>
        ) : (
          <ul className="divide-y divide-(--border-default) text-sm">
            {settings.map((setting) => (
              <li key={setting.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="font-mono text-xs text-(--text-secondary)">{setting.key}</span>
                <span className="font-medium">{String(setting.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AuditTab() {
  const [entries, setEntries] = useState<Array<{ id: string; action: string; objectType: string; objectId: string | null; actor: { name: string } | null; createdAt: string; after: unknown }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/audit?page=${targetPage}&pageSize=25`);
      if (!response.ok) return;
      const body = (await response.json()) as { data: typeof entries; meta: { total: number } };
      setEntries(body.data);
      setTotal(body.meta.total);
      setPage(targetPage);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Governance"
        title="Audit log"
        subtitle="Review configuration and record changes across your workspace."
        metrics={[{ label: "Entries", value: total, tone: "brand" }, { label: "Page", value: page, tone: "info" }, { label: "Page size", value: 25, tone: "success" }]}
      />
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3">
          <div><h2 className="text-sm font-semibold">Recent activity</h2><p className="mt-0.5 text-xs text-(--text-tertiary)">Append-only history of important changes.</p></div>
          <span className="badge badge-neutral">{total} entries</span>
        </div>
        <table className="table">
          <thead>
            <tr className="border-b border-(--border-default) bg-(--bg-hover) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Object</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={8} columns={4} />
            ) : entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-(--text-secondary)">
                  {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}
                </td>
                <td className="px-3 py-3"><span className="font-medium">{entry.actor?.name ?? "System"}</span></td>
                <td className="px-3 py-3"><span className="badge badge-neutral">{entry.action.replaceAll("_", " ").toLowerCase()}</span></td>
                <td className="px-3 py-3 text-xs text-(--text-secondary)">
                  <span className="font-medium text-(--text-primary)">{entry.objectType.toLowerCase()}</span>
                  {entry.objectId ? ` · …${entry.objectId.slice(-6)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-(--text-secondary)">
        <span>Page {page} · {total} entries</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => void load(page - 1)} className="btn btn-secondary" style={{ height: "28px" }}>
            Previous
          </button>
          <button type="button" disabled={page * 25 >= total} onClick={() => void load(page + 1)} className="btn btn-secondary" style={{ height: "28px" }}>
            Next
          </button>
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
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-4">
        <div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm text-(--text-secondary)">{description}</p></div>
        <span className={enabled ? "badge badge-success" : "badge badge-neutral"}>{enabled ? "Connected" : "Not configured"}</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-(--text-tertiary)"><span className={`h-2 w-2 rounded-full ${enabled ? "bg-(--success)" : "bg-(--gray-400)"}`} />{detail}</div>
    </section>
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
        actions={<button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><span aria-hidden>+</span> New object type</button>}
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
            <div>
              <label htmlFor="co-key" className="mb-1 block text-xs font-medium">Key (URL slug) *</label>
              <input id="co-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9-]*" placeholder="properties" className={inputClass} />
            </div>
            <div>
              <label htmlFor="co-name" className="mb-1 block text-xs font-medium">Name (singular) *</label>
              <input id="co-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Property" className={inputClass} />
            </div>
            <div>
              <label htmlFor="co-plural" className="mb-1 block text-xs font-medium">Plural name *</label>
              <input id="co-plural" value={pluralName} onChange={(e) => setPluralName(e.target.value)} required placeholder="Properties" className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="co-desc" className="mb-1 block text-xs font-medium">Description</label>
            <input id="co-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="co-fields" className="mb-1 block text-xs font-medium">
              Fields (JSON array) — key, label, type, required, options, sortOrder
            </label>
            <textarea
              id="co-fields"
              value={fieldsJson}
              onChange={(e) => setFieldsJson(e.target.value)}
              rows={6}
              className={`${inputClass} font-mono text-xs`}
              placeholder={'[{"key":"title","label":"Title","type":"TEXT","required":true,"sortOrder":1},{"key":"price","label":"Price","type":"NUMBER","sortOrder":2}]'}
            />
            <p className="mt-1 text-[10px] text-(--text-tertiary)">
              Types: TEXT, NUMBER, CURRENCY, BOOLEAN, DATE, DATETIME, SELECT, MULTI_SELECT, PHONE, EMAIL, URL
            </p>
          </div>
          <div className="form-actions"><button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><span aria-hidden>+</span> Create object</button></div>
        </form>
        </SetupFormModal>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {loading ? (
          <AdminCardGridSkeleton cards={4} />
        ) : objects.map((object) => (
          <div key={object.id} className="card card-interactive p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold">
                  {object.pluralName}
                  <span className="ml-2 font-mono text-xs text-(--text-tertiary)">/{object.key}</span>
                </p>
                {object.description ? <p className="text-xs text-(--text-secondary)">{object.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2"><span className={object.active ? "badge badge-success" : "badge badge-neutral"}>{object.active ? "active" : "inactive"}</span><span className="badge badge-neutral">{object._count.records} records</span><span className="badge badge-neutral">{object.fields?.length ?? 0} fields</span></div>
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
          </div>
        ))}
        {!loading && objects.length === 0 ? (
          <p className="card empty-state">
            No custom objects yet — create one above (e.g. Properties, Vendors).
          </p>
        ) : null}
      </div>

      {confirmDialog}
    </div>
  );
}
