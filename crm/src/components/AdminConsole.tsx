"use client";

import Link from "next/link";
import { useCrmBranding } from "@/components/BrandingProvider";
import { Icon } from "@/components/Icon";
import { UserSmtpPanel } from "@/components/UserSmtpPanel";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/Dialogs";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { Modal } from "@/components/Modal";
import { useTableSession, writeTableSession } from "@/components/useTableSession";
import { PERMISSION_CATEGORIES } from "@/server/permissions";


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
        actions={canManage ? <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><Icon name="plus" size={14} /> Add status</button> : undefined}
        metrics={[{ label: "Statuses", value: rows.length, tone: "brand" }, { label: "Objects", value: new Set(rows.map((row) => row.appliesTo)).size, tone: "info" }, { label: "Defaults", value: rows.filter((row) => row.isDefault).length, tone: "success" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add status" onClose={() => setShowForm(false)}>
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className="form-section-title">Lifecycle status</p><p className="form-section-help">Statuses appear on records and guide your team through the relationship lifecycle.</p></div>
          <div>
            <label htmlFor="s-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required className="input"/>
          </div>
          <div>
            <label htmlFor="s-applies" className="form-label">Applies to</label>
            <select id="s-applies" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className="input">
              <option value="LEAD">Leads</option>
              <option value="CONTACT">Contacts</option>
              <option value="CUSTOMER">Customers</option>
            </select>
          </div>
          <div>
            <label htmlFor="s-cat" className="form-label">Category</label>
            <select id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              <option value="OPEN">Open</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
              <option value="INVALID">Invalid</option>
            </select>
          </div>
          <div className="form-actions sm:col-span-2"><button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">
            <Icon name="plus" size={14} /> Add status
          </button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Object</th>
              <th>Category</th>
              <th>In use</th>
              <th>Default</th>
              {canManage ? <th className="text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={5} columns={canManage ? 6 : 5} />
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td className="font-medium">{row.name}</td>
                <td><span className="badge badge-neutral">{row.appliesTo.toLowerCase()}</span></td>
                <td><span className={`badge ${row.category === "OPEN" ? "badge-success" : row.category === "CONVERTED" ? "badge-info" : row.category === "INVALID" ? "badge-error" : "badge-neutral"}`}>{row.category.toLowerCase()}</span></td>
                <td className="tabular-nums text-(--text-secondary)">{row._count.leads + row._count.contacts + row._count.customers}</td>
                <td>{row.isDefault ? <span className="badge badge-brand">Default</span> : <span className="text-xs text-(--text-tertiary)">—</span>}</td>
                {canManage ? (
                  <td className="text-right whitespace-nowrap">
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
        <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3"><div><h2 className="text-sm font-semibold">Potential status</h2><p className="mt-0.5 text-xs text-(--text-tertiary)">Segment leads by commercial potential: Junior, Senior, Institutional, or VIP.</p></div>{canManage ? <button type="button" onClick={() => setShowPotentialForm(true)} className="btn btn-secondary"><Icon name="plus" size={14} /> Add potential status</button> : null}</div>
        {showPotentialForm && canManage ? <SetupFormModal title="Add potential status" onClose={() => setShowPotentialForm(false)}><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); const response = await fetch("/api/potential-statuses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: potentialName, sortOrder: potentialRows.length + 1 }) }); if (!response.ok) { setError("Could not create potential status."); return; } setPotentialName(""); setShowPotentialForm(false); void load(); }}><div><label htmlFor="potential-name" className="form-label">Name <span className="form-required">*</span></label><input id="potential-name" value={potentialName} onChange={(event) => setPotentialName(event.target.value)} required className="input" placeholder="VIP" /></div><div className="form-actions"><button type="button" onClick={() => setShowPotentialForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><Icon name="plus" size={14} /> Add status</button></div></form></SetupFormModal> : null}
        {loading ? <div className="p-3"><AdminCardGridSkeleton cards={4} /></div> : <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">{potentialRows.map((status) => {
          const leadCount = status._count?.leads ?? 0;
          return (
            <div key={status.id} className="card flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{status.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {status._count ? <span className="badge badge-neutral">{leadCount} {leadCount === 1 ? "lead" : "leads"}</span> : null}
                  {status.isDefault ? <span className="badge badge-brand">default</span> : null}
                </div>
              </div>
              {canManage ? (
                <button type="button" onClick={async () => { const response = await fetch(`/api/potential-statuses/${status.id}`, { method: "DELETE" }); if (!response.ok) setError("Potential status is in use or could not be deleted."); else void load(); }} className="icon-button" aria-label={`Delete ${status.name}`} title={`Delete ${status.name}`}>
                  <Icon name="close" size={14} />
                </button>
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
        actions={canManage ? <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><Icon name="plus" size={14} /> Add tag</button> : undefined}
        metrics={[{ label: "Tags", value: rows.length, tone: "brand" }, { label: "Applied", value: rows.reduce((sum, row) => sum + row._count.links, 0), tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm && canManage ? (
        <SetupFormModal title="Add tag" onClose={() => setShowForm(false)}>
        <form method="post" onSubmit={async (event) => { await create(event); setShowForm(false); }} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="sm:col-span-2"><p className="form-section-title">Record label</p><p className="form-section-help">Use tags for quick segmentation, prioritization, and saved views.</p></div>
          <div>
            <label htmlFor="t-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required className="input"/>
          </div>
          <div>
            <label htmlFor="t-color" className="form-label">Color</label>
            <input
              id="t-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="input cursor-pointer"
              style={{ width: "56px", padding: "2px" }}
              aria-label="Tag color"
              title="Choose a tag color"
            />
          </div>
          <div className="form-actions sm:col-span-2"><button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">
            <Icon name="plus" size={14} /> Add tag
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
            <div key={row.id} className="card card-interactive flex items-center gap-3 p-4">
              <span className="h-7 w-7 shrink-0 rounded-md border border-black/10" style={{ background: row.color ?? "#78716c" }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="mt-0.5 text-xs text-(--text-tertiary)">{row._count.links} {row._count.links === 1 ? "record" : "records"}</p>
              </div>
              {canManage ? (
                <button type="button" onClick={() => void remove(row.id)} className="icon-button" aria-label={`Delete ${row.name}`} title={`Delete ${row.name}`}>
                  <Icon name="close" size={14} />
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
        actions={canManage ? <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><Icon name="plus" size={14} /> Add field</button> : undefined}
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
              <label htmlFor="cf-object" className="form-label">Object</label>
              <select id="cf-object" value={objectType} onChange={(e) => setObjectType(e.target.value)} className="input">
              <option value="LEAD">Lead</option>
              <option value="CONTACT">Contact</option>
              <option value="ACCOUNT">Account</option>
              <option value="CUSTOMER">Customer</option>
              </select>
            </div>
            <div>
              <label htmlFor="cf-label" className="form-label">Label</label>
              <input id="cf-label" value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="e.g. Customer tier" className="input" />
            </div>
            <div>
              <label htmlFor="cf-key" className="form-label">Key</label>
              <input id="cf-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-zA-Z0-9_]*" title="Start with a lowercase letter; use letters, numbers, or underscores." placeholder="e.g. customerTier" className="input" />
              <p className="mt-1 text-xs text-(--text-tertiary)">Lowercase camelCase, letters, numbers, and underscores.</p>
            </div>
            <div>
              <label htmlFor="cf-type" className="form-label">Type</label>
              <select id="cf-type" value={fieldType} onChange={(e) => setFieldType(e.target.value)} className="input">
              {["TEXT", "NUMBER", "CURRENCY", "BOOLEAN", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "PHONE", "EMAIL", "URL"].map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ").toLowerCase()}</option>
              ))}
              </select>
            </div>
          </div>
          {fieldType === "SELECT" || fieldType === "MULTI_SELECT" ? (
            <div>
              <label htmlFor="cf-options" className="form-label">Options</label>
              <input id="cf-options" value={options} onChange={(e) => setOptions(e.target.value)} required placeholder="e.g. New, Active, Archived" className="input" />
              <p className="mt-1 text-xs text-(--text-tertiary)">Separate each option with a comma.</p>
            </div>
          ) : null}
          <div className="form-actions">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary"><Icon name="plus" size={14} /> Add field</button>
          </div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Object</th>
              <th>Label</th>
              <th>Key</th>
              <th>Type</th>
              <th>Options</th>
              <th>State</th>
              {canManage ? <th className="text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={6} columns={canManage ? 7 : 6} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><p className="empty-state-title">No custom fields defined</p><p className="empty-state-description">Add a field above to capture business-specific details on records.</p></div></td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.objectType.toLowerCase()}</td>
                  <td className="font-medium">{row.label}</td>
                  <td className="font-mono text-xs">{row.key}</td>
                  <td className="font-mono text-xs">{row.fieldType.replaceAll("_", " ").toLowerCase()}</td>
                  <td>
                    {row.options && row.options.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {row.options.slice(0, 3).map((option) => <span key={option} className="badge badge-neutral">{option}</span>)}
                        {row.options.length > 3 ? <span className="self-center text-xs text-(--text-tertiary)">+{row.options.length - 3} more</span> : null}
                      </span>
                    ) : "—"}
                  </td>
                  <td><span className={row.active ? "badge badge-success" : "badge badge-neutral"}>{row.active ? "active" : "hidden"}</span></td>
                  {canManage ? (
                    <td className="text-right">
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
        actions={canManage ? <button type="button" onClick={() => setShowUserForm(true)} className="btn btn-primary"><Icon name="plus" size={14} /> New user</button> : undefined}
        metrics={[{ label: "Total users", value: users.length, tone: "brand" }, { label: "Active", value: users.filter((user) => user.status === "ACTIVE").length, tone: "success" }, { label: "Teams", value: teams.length, tone: "info" }, { label: "Roles", value: roles.length, tone: "warning" }]}
      />
      {showUserForm && canManage ? (
        <SetupFormModal title="New user" onClose={() => setShowUserForm(false)}>
        <form method="post" onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className="form-section-title">Access profile</p><p className="form-section-help">Create a person, then assign their role and scope.</p></div>
          <div>
            <label htmlFor="au-email" className="form-label">Email <span className="form-required">*</span></label>
            <input id="au-email" type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} required className="input" />
          </div>
          <div>
            <label htmlFor="au-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="au-name" value={uName} onChange={(e) => setUName(e.target.value)} required className="input" />
          </div>
          <div>
            <label htmlFor="au-pass" className="form-label">Password <span className="form-required">*</span> (10+)</label>
            <input id="au-pass" type="password" value={uPassword} onChange={(e) => setUPassword(e.target.value)} required minLength={10} className="input" />
          </div>
          <div>
            <label htmlFor="au-role" className="form-label">Role</label>
            <select id="au-role" value={uRole} onChange={(e) => setURole(e.target.value)} className="input">
              {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
            </select>
          </div>
          <div className="form-actions sm:col-span-2"><button type="button" onClick={() => setShowUserForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><Icon name="plus" size={14} /> Create user</button></div>
        </form>
        </SetupFormModal>
      ) : null}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold">People</h3>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">Roles, access, and activity across your workspace</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="people-search" className="sr-only">Search users</label>
            <div className="relative w-full sm:w-64">
              <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--text-tertiary)" />
              <input id="people-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, roles, teams" className="input pl-9" />
            </div>
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
            <select aria-label="Sort users" value={sort} onChange={(event) => setSort(event.target.value)} className="input"><option value="name">Name</option><option value="lastLogin">Last login</option></select>
            <span className="badge badge-neutral">{filteredUsers.length} of {users.length}</span>
          </div>
        </div>
        {canManage && selectedIds.length > 0 ? <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-selected) px-4 py-2 text-sm"><span>{selectedIds.length} selected</span><button type="button" onClick={() => void suspendSelected()} className="btn btn-destructive btn-sm">Suspend selected</button></div> : null}
        <table className="table">
          <thead>
            <tr>
              {canManage ? <th className="w-10"><input type="checkbox" aria-label="Select all visible users" checked={filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.includes(user.id))} onChange={(event) => setSelectedIds(event.target.checked ? filteredUsers.map((user) => user.id) : [])} /></th> : null}
              <th>User</th>
              <th>Role</th>
              <th>Teams</th>
              <th>Last login</th>
              <th>Status</th>
              {canManage ? <th className="text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={6} columns={canManage ? 6 : 5} />
            ) : filteredUsers.map((user) => (
              <tr key={user.id} className={selectedUserId === user.id ? "bg-(--bg-selected)" : undefined}>
                {canManage ? <td><input type="checkbox" aria-label={`Select ${user.name}`} checked={selectedIds.includes(user.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} /></td> : null}
                <td><button type="button" onClick={() => setSelectedUserId(user.id)} className="flex items-center gap-3 text-left"><span className="avatar avatar-sm" style={{ background: "var(--brand-100)", color: "var(--brand-800)" }}>{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><span className="block font-medium hover:text-(--text-brand)">{user.name}</span><span className="block text-xs text-(--text-tertiary)">{user.email}</span></span></button></td>
                <td>
                  {canManage ? (
                    <select aria-label={`Role for ${user.name}`} value={user.role.key} onChange={(e) => void patchUser(user.id, { roleKey: e.target.value })} className="input">
                      {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                    </select>
                  ) : user.role.name}
                </td>
                <td className="text-xs">{user.memberships.map((m) => m.team.name).join(", ") || "—"}</td>
                <td className="text-xs">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "never"}</td>
                <td><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${user.status === "ACTIVE" ? "bg-(--success-bg) text-(--success)" : user.status === "SUSPENDED" ? "bg-(--warning-bg) text-(--warning)" : "bg-(--bg-subtle) text-(--text-secondary)"}`}><span aria-hidden className={`h-1.5 w-1.5 rounded-full ${user.status === "ACTIVE" ? "bg-(--success)" : user.status === "SUSPENDED" ? "bg-(--warning)" : "bg-(--text-tertiary)"}`} />{user.status.charAt(0) + user.status.slice(1).toLowerCase()}</span></td>
                {canManage ? (
                  <td className="text-right whitespace-nowrap">
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
            {!loading && filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 5}>
                  <div className="empty-state">
                    <p className="empty-state-title">No users match this view</p>
                    <p className="empty-state-description">Adjust the search or status filter.</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedUser ? <div className="card border-(--brand-200) p-5" aria-label={`Profile for ${selectedUser.name}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3"><span className="avatar flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold" style={{ background: "var(--brand-100)", color: "var(--brand-800)" }}>{selectedUser.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><p className="card-title">User profile</p><h3 className="mt-0.5 flex items-center gap-2 text-lg font-semibold">{selectedUser.name}<span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${selectedUser.status === "ACTIVE" ? "bg-(--success-bg) text-(--success)" : "bg-(--warning-bg) text-(--warning)"}`}>{selectedUser.status.charAt(0) + selectedUser.status.slice(1).toLowerCase()}</span><span className="rounded-full bg-(--bg-subtle) px-2 py-0.5 text-[11px] font-medium text-(--text-secondary)">{selectedUser.role.name}</span></h3><p className="text-sm text-(--text-secondary)">{selectedUser.email}</p></div></div>
          <button type="button" onClick={() => setSelectedUserId(null)} className="btn btn-secondary">Close</button>
        </div>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div><p className="card-title">Access status</p><p className="mt-1 font-medium">{selectedUser.status.toLowerCase()}</p></div>
          <div><p className="card-title">Role</p><p className="mt-1 font-medium">{selectedUser.role.name}</p></div>
          <div><p className="card-title">Last login</p><p className="mt-1 font-medium">{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "Never"}</p></div>
        </div>
        <div className="mt-4 border-t border-(--border-default) pt-4"><p className="card-title">Team assignments</p><p className="mt-1 text-sm">{selectedUser.memberships.map((membership) => membership.team.name).join(", ") || "No teams assigned"}</p></div>
        <div className="mt-4 border-t border-(--border-default) pt-4"><p className="card-title">Workspace overview</p><div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link href={`/emails?userId=${selectedUser.id}&userName=${encodeURIComponent(selectedUser.name)}`} className="card card-interactive flex items-center gap-2.5 p-3"><Icon name="mail" size={16} className="text-(--text-tertiary)" /><span className="text-sm font-medium">Mailbox</span></Link>
          <Link href={`/leads?assignment=user:${selectedUser.id}`} className="card card-interactive flex items-center gap-2.5 p-3"><Icon name="target" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.assignedLeads}</span><span className="block text-xs text-(--text-secondary)">Leads</span></span></Link>
          <Link href={`/contacts?ownerUserId=${selectedUser.id}`} className="card card-interactive flex items-center gap-2.5 p-3"><Icon name="users" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedContacts}</span><span className="block text-xs text-(--text-secondary)">Contacts</span></span></Link>
          <Link href={`/accounts?ownerUserId=${selectedUser.id}`} className="card card-interactive flex items-center gap-2.5 p-3"><Icon name="building" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedAccounts}</span><span className="block text-xs text-(--text-secondary)">Accounts</span></span></Link>
          <Link href={`/customers?ownerUserId=${selectedUser.id}`} className="card card-interactive flex items-center gap-2.5 p-3"><Icon name="heart" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedCustomers}</span><span className="block text-xs text-(--text-secondary)">Customers</span></span></Link>
          <Link href={`/opportunities?ownerUserId=${selectedUser.id}`} className="card card-interactive flex items-center gap-2.5 p-3"><Icon name="trending" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedOpps}</span><span className="block text-xs text-(--text-secondary)">Opportunities</span></span></Link>
          <Link href={`/tasks?mine=0&ownerUserId=${selectedUser.id}`} className="card card-interactive flex items-center gap-2.5 p-3"><Icon name="check" size={16} className="text-(--text-tertiary)" /><span className="min-w-0"><span className="block text-lg font-semibold leading-tight">{selectedUser._count.ownedTasks}</span><span className="block text-xs text-(--text-secondary)">Tasks</span></span></Link>
        </div></div>
        <div className="mt-4 border-t border-(--border-default) pt-4"><div className="flex items-center justify-between"><p className="card-title">Recent activity</p><span className="text-[11px] text-(--text-tertiary)">{userActivity.length} events</span></div>
          {activityError ? <p role="alert" className="mt-2 text-sm text-(--error)">{activityError}</p> : activityLoading ? <div className="mt-2 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-4 w-1/2" /></div> : userActivity.length === 0 ? <p className="mt-2 text-sm text-(--text-tertiary)">No recorded activity yet.</p> : <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto">{userActivity.map((event) => <li key={event.id} className="flex items-start justify-between gap-3 rounded-md border border-(--border-default) px-3 py-2 text-sm"><span><span className="font-medium">{event.label}</span><span className="ml-2 text-xs text-(--text-tertiary)">{event.objectType.toLowerCase()}</span></span><time className="shrink-0 text-[11px] text-(--text-tertiary)">{new Date(event.createdAt).toLocaleDateString()}</time></li>)}</ul>}
        </div>
        {canManage ? <UserSmtpPanel userId={selectedUser.id} userEmail={selectedUser.email} /> : null}
        {canManage ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void patchUser(selectedUser.id, { status: selectedUser.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })} className="btn btn-secondary">{selectedUser.status === "ACTIVE" ? "Suspend access" : "Restore access"}</button><button type="button" onClick={() => setSelectedUserId(null)} className="btn btn-secondary">Done</button></div> : null}
      </div> : null}

      <div className="flex flex-col gap-3 border-b border-(--border-default) pb-3 pt-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="card-title mb-1">Structure</p>
          <h3 className="text-lg font-semibold tracking-tight">Teams <span className="text-sm font-normal text-(--text-tertiary)">{teams.length}</span></h3>
        </div>
        {canManage ? (
          <button type="button" onClick={() => setShowTeamForm((p) => !p)} className="btn btn-secondary">
            <Icon name="plus" size={14} /> New team
          </button>
        ) : null}
      </div>
      {showTeamForm && canManage ? (
        <SetupFormModal title="New team" onClose={() => setShowTeamForm(false)}>
        <form method="post" onSubmit={createTeam} className="space-y-4">
          <div><p className="form-section-title">Team structure</p><p className="form-section-help">Teams shape visibility, ownership, and collaboration.</p></div>
          <div>
            <label htmlFor="at-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="at-name" value={tName} onChange={(e) => setTName(e.target.value)} required minLength={2} className="input" />
          </div>
          <div>
            <label htmlFor="at-leader" className="form-label">Leader</label>
            <select id="at-leader" value={tLeader} onChange={(e) => setTLeader(e.target.value)} className="input">
              <option value="">— none —</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div className="form-actions"><button type="button" onClick={() => setShowTeamForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><Icon name="plus" size={14} /> Create team</button></div>
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
      ) : selectedRole ? <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div><label htmlFor="role-select" className="form-label">Role</label><select id="role-select" value={selectedRole.id} onChange={(event) => setSelectedRoleId(event.target.value)} className="input mt-1 min-w-56 font-semibold">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><p className="mt-2 text-xs text-(--text-secondary)">{selectedRole.description} · {selectedRole._count.users} assigned users · {selectedRole.scope.toLowerCase()} scope</p></div>
          <div className="relative w-full sm:w-64"><label htmlFor="permission-search" className="sr-only">Search permissions</label><Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--text-tertiary)" /><input id="permission-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search permissions" className="input pl-9" /></div>
        </div>
        <div className="divide-y divide-(--border-default)">
          {visibleCategories.map((category) => {
            const enabledCount = category.permissions.filter(({ key }) => selectedRole.permissions.some((entry) => entry.permission === key)).length;
            const isExpanded = expanded.includes(category.key);
            const locked = selectedRole.key === "SUPER_ADMIN" || !canManage;
            return <div key={category.key}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-(--bg-hover)">
                <button type="button" aria-expanded={isExpanded} onClick={() => setExpanded((current) => current.includes(category.key) ? current.filter((key) => key !== category.key) : [...current, category.key])} className="w-5 text-left text-(--text-secondary)"><Icon name={isExpanded ? "chevron_down" : "chevron_right"} size={14} /></button>
                <button type="button" onClick={() => setExpanded((current) => current.includes(category.key) ? current : [...current, category.key])} className="flex-1 text-left text-sm font-medium">{category.label}</button>
                <span className="badge badge-neutral">{enabledCount} / {category.permissions.length} enabled</span>
                <button type="button" disabled={locked} onClick={() => void setCategory(selectedRole.id, category.permissions, true)} className="btn btn-ghost btn-sm disabled:opacity-40">Enable all</button>
                <button type="button" disabled={locked} onClick={() => void setCategory(selectedRole.id, category.permissions, false)} className="btn btn-ghost btn-sm disabled:opacity-40">Disable all</button>
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
        actions={<button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><Icon name="plus" size={14} /> Add setting</button>}
        metrics={[{ label: "Configured", value: settings.length, tone: "brand" }, { label: "Storage", value: "Workspace", tone: "info" }]}
      />
      {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      {showForm ? <SetupFormModal title="Add workspace setting" onClose={() => setShowForm(false)}>
      <form method="post" onSubmit={async (event) => { await save(event); setShowForm(false); }} className="space-y-4">
        <div><p className="form-section-title">Workspace default</p><p className="form-section-help">Use a namespaced key such as org.currency or tasks.defaultDueDays.</p></div>
        <div>
          <label htmlFor="set-key" className="form-label">Key (e.g. org.currency)</label>
          <input id="set-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9_.]*" className="input" />
        </div>
        <div>
          <label htmlFor="set-value" className="form-label">Value</label>
          <input id="set-value" value={value} onChange={(e) => setValue(e.target.value)} required className="input" />
        </div>
        <div className="form-actions"><button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><Icon name="plus" size={14} /> Save setting</button></div>
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
          <div className="card-body">
            <dl className="admin-desc-list">
              {settings.map((setting) => (
                <Fragment key={setting.id}>
                  <dt className="font-mono">{setting.key}</dt>
                  <dd className="font-medium">{String(setting.value)}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        )}
      </div>
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
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3">
          <div><h2 className="text-sm font-semibold">Recent activity</h2><p className="mt-0.5 text-xs text-(--text-tertiary)">Append-only history of important changes.</p></div>
          <span className="badge badge-neutral">{total} entries</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Object</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={8} columns={4} />
            ) : entries.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap text-xs text-(--text-secondary)">
                  {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}
                </td>
                <td><span className="font-medium">{entry.actor?.name ?? "System"}</span></td>
                <td><span className={`badge ${entry.action.endsWith("_CREATED") ? "badge-success" : entry.action.endsWith("_UPDATED") ? "badge-info" : entry.action.endsWith("_DELETED") ? "badge-error" : "badge-neutral"}`}>{entry.action.replaceAll("_", " ").toLowerCase()}</span></td>
                <td className="text-xs text-(--text-secondary)">
                  <span className="font-medium text-(--text-primary)">{entry.objectType.toLowerCase()}</span>
                  {entry.objectId ? ` · …${entry.objectId.slice(-6)}` : ""}
                </td>
              </tr>
            ))}
            {!loading && entries.length === 0 ? (
              <tr><td colSpan={4}><div className="empty-state"><p className="empty-state-title">No audit entries yet</p><p className="empty-state-description">Configuration and record changes will appear here as they happen.</p></div></td></tr>
            ) : null}
          </tbody>
        </table>
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
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
              className="input input-sm"
              style={{ width: "auto" }}
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn btn-secondary btn-sm">
            Previous
          </button>
          <button type="button" disabled={page * pageSize >= total} onClick={() => setPage((current) => current + 1)} className="btn btn-secondary btn-sm">
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
    <section className="card p-4">
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
        <span className={enabled ? "badge badge-success" : "badge badge-neutral"}>{enabled ? "Connected" : "Not configured"}</span>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-(--border-default) pt-3 text-xs text-(--text-tertiary)"><span className={`h-2 w-2 rounded-full ${enabled ? "bg-(--success)" : "bg-(--gray-400)"}`} />{detail}</div>
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
        actions={<button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><Icon name="plus" size={14} /> New object type</button>}
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
              <label htmlFor="co-key" className="form-label">Key (URL slug) *</label>
              <input id="co-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9-]*" placeholder="properties" className="input" />
            </div>
            <div>
              <label htmlFor="co-name" className="form-label">Name (singular) *</label>
              <input id="co-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Property" className="input" />
            </div>
            <div>
              <label htmlFor="co-plural" className="form-label">Plural name *</label>
              <input id="co-plural" value={pluralName} onChange={(e) => setPluralName(e.target.value)} required placeholder="Properties" className="input" />
            </div>
          </div>
          <div>
            <label htmlFor="co-desc" className="form-label">Description</label>
            <input id="co-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="co-fields" className="form-label">
              Fields (JSON array) — key, label, type, required, options, sortOrder
            </label>
            <textarea
              id="co-fields"
              value={fieldsJson}
              onChange={(e) => setFieldsJson(e.target.value)}
              rows={6}
              className="input font-mono"
              placeholder={'[{"key":"title","label":"Title","type":"TEXT","required":true,"sortOrder":1},{"key":"price","label":"Price","type":"NUMBER","sortOrder":2}]'}
            />
            <p className="mt-1 text-[10px] text-(--text-tertiary)">
              Types: TEXT, NUMBER, CURRENCY, BOOLEAN, DATE, DATETIME, SELECT, MULTI_SELECT, PHONE, EMAIL, URL
            </p>
          </div>
          <div className="form-actions"><button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary"><Icon name="plus" size={14} /> Create object</button></div>
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
                <p className="text-base font-medium">
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
