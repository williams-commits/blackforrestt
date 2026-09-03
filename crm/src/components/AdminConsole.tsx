"use client";

import { useCallback, useEffect, useState } from "react";

/** Administration console: statuses, tags, custom fields, teams, users, audit. */
export function AdminConsole({
  canManage,
  canAudit,
}: {
  canManage: boolean;
  canAudit: boolean;
}) {
  const [tab, setTab] = useState<"statuses" | "tags" | "fields" | "teams" | "audit">("statuses");

  const tabs = [
    { key: "statuses" as const, label: "Statuses" },
    { key: "tags" as const, label: "Tags" },
    { key: "fields" as const, label: "Custom fields" },
    { key: "teams" as const, label: "Teams & users" },
    ...(canAudit ? [{ key: "audit" as const, label: "Audit log" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Administration</h1>
        <p className="text-sm text-stone-500">
          {canManage
            ? "Business configuration — changes are audit-logged."
            : "Read-only view — SETTINGS_MANAGE required for changes."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === entry.key ? "bg-[var(--brand)] text-white" : "border border-stone-300 bg-white hover:bg-stone-50"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {tab === "statuses" ? <StatusesTab canManage={canManage} /> : null}
      {tab === "tags" ? <TagsTab canManage={canManage} /> : null}
      {tab === "fields" ? <FieldsTab canManage={canManage} /> : null}
      {tab === "teams" ? <TeamsTab /> : null}
      {tab === "audit" ? <AuditTab /> : null}
    </div>
  );
}

const inputClass = "rounded-md border border-stone-300 px-2 py-1.5 text-sm";

function StatusesTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; appliesTo: string; category: string; sortOrder: number; isDefault: boolean; _count: { leads: number; contacts: number; customers: number } }>>([]);
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState("LEAD");
  const [category, setCategory] = useState("OPEN");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/record-statuses");
    if (response.ok) setRows((await response.json()).data);
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
    if (!window.confirm("Delete this status?")) return;
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
      {error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {canManage ? (
        <form method="post" onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-lg border border-stone-200 bg-white p-4">
          <div>
            <label htmlFor="s-name" className="mb-1 block text-xs font-medium">Name</label>
            <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="s-applies" className="mb-1 block text-xs font-medium">Applies to</label>
            <select id="s-applies" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className={inputClass}>
              <option value="LEAD">Leads</option>
              <option value="CONTACT">Contacts</option>
              <option value="CUSTOMER">Customers</option>
            </select>
          </div>
          <div>
            <label htmlFor="s-cat" className="mb-1 block text-xs font-medium">Category</label>
            <select id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="OPEN">Open</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
              <option value="INVALID">Invalid</option>
            </select>
          </div>
          <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
            Add
          </button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Object</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">In use</th>
              <th className="px-3 py-2 font-medium">Default</th>
              {canManage ? <th className="px-3 py-2 text-right font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">{row.appliesTo.toLowerCase()}</td>
                <td className="px-3 py-2">{row.category.toLowerCase()}</td>
                <td className="px-3 py-2">{row._count.leads + row._count.contacts + row._count.customers}</td>
                <td className="px-3 py-2">{row.isDefault ? "★" : ""}</td>
                {canManage ? (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {!row.isDefault ? (
                      <button type="button" onClick={() => void makeDefault(row.id)} className="mr-2 text-xs text-[var(--brand)] hover:underline">
                        make default
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void remove(row.id)} className="text-xs text-red-600 hover:underline">
                      delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TagsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; color: string | null; _count: { links: number } }>>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1f6f43");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/tags");
    if (response.ok) setRows((await response.json()).data);
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
    if (!window.confirm("Delete this tag? It will be removed from all records.")) return;
    await fetch(`/api/tags?id=${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {canManage ? (
        <form method="post" onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-lg border border-stone-200 bg-white p-4">
          <div>
            <label htmlFor="t-name" className="mb-1 block text-xs font-medium">Name</label>
            <input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="t-color" className="mb-1 block text-xs font-medium">Color</label>
            <input id="t-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 rounded-md border border-stone-300" />
          </div>
          <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
            Add
          </button>
        </form>
      ) : null}
      <div className="flex flex-wrap gap-2 rounded-lg border border-stone-200 bg-white p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-stone-400">No tags.</p>
        ) : (
          rows.map((row) => (
            <span key={row.id} className="flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: row.color ?? "#78716c" }}>
              {row.name} ({row._count.links})
              {canManage ? (
                <button type="button" onClick={() => void remove(row.id)} className="opacity-80 hover:opacity-100" aria-label={`Delete ${row.name}`}>
                  ×
                </button>
              ) : null}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function FieldsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; objectType: string; key: string; label: string; fieldType: string; required: boolean; active: boolean; options: string[] | null }>>([]);
  const [objectType, setObjectType] = useState("LEAD");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/custom-fields");
    if (response.ok) setRows((await response.json()).data);
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
    if (!window.confirm("Delete this custom field? Existing values remain in records but are no longer validated.")) return;
    await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {canManage ? (
        <form method="post" onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-lg border border-stone-200 bg-white p-4">
          <div>
            <label htmlFor="cf-object" className="mb-1 block text-xs font-medium">Object</label>
            <select id="cf-object" value={objectType} onChange={(e) => setObjectType(e.target.value)} className={inputClass}>
              <option value="LEAD">Lead</option>
              <option value="CONTACT">Contact</option>
              <option value="ACCOUNT">Account</option>
              <option value="CUSTOMER">Customer</option>
            </select>
          </div>
          <div>
            <label htmlFor="cf-key" className="mb-1 block text-xs font-medium">Key (camelCase)</label>
            <input id="cf-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-zA-Z0-9_]*" className={inputClass} />
          </div>
          <div>
            <label htmlFor="cf-label" className="mb-1 block text-xs font-medium">Label</label>
            <input id="cf-label" value={label} onChange={(e) => setLabel(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="cf-type" className="mb-1 block text-xs font-medium">Type</label>
            <select id="cf-type" value={fieldType} onChange={(e) => setFieldType(e.target.value)} className={inputClass}>
              {["TEXT", "NUMBER", "CURRENCY", "BOOLEAN", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "PHONE", "EMAIL", "URL"].map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ").toLowerCase()}</option>
              ))}
            </select>
          </div>
          {fieldType === "SELECT" || fieldType === "MULTI_SELECT" ? (
            <div>
              <label htmlFor="cf-options" className="mb-1 block text-xs font-medium">Options (comma-sep)</label>
              <input id="cf-options" value={options} onChange={(e) => setOptions(e.target.value)} className={inputClass} />
            </div>
          ) : null}
          <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
            Add
          </button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
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
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-stone-400">No custom fields defined.</td></tr>
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
                      <button type="button" onClick={() => void remove(row.id)} className="text-xs text-red-600 hover:underline">
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
    </div>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState<Array<{ id: string; name: string; leader: { name: string } | null; members: Array<{ id: string; name: string }> }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; role: { name: string } }>>([]);

  useEffect(() => {
    void fetch("/api/teams").then((r) => (r.ok ? r.json() : null)).then((body) => setTeams(body?.data ?? []));
    void fetch("/api/users").then((r) => (r.ok ? r.json() : null)).then((body) => setUsers(body?.data ?? []));
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Teams</p>
        <ul className="space-y-2">
          {teams.map((team) => (
            <li key={team.id} className="text-sm">
              <span className="font-medium">{team.name}</span>
              <span className="text-xs text-stone-400">
                {" "}· lead {team.leader?.name ?? "—"} · {team.members.length} member(s)
              </span>
              <p className="text-xs text-stone-500">{team.members.map((member) => member.name).join(", ")}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Users</p>
        <ul className="space-y-1">
          {users.map((user) => (
            <li key={user.id} className="flex justify-between text-sm">
              <span>{user.name}</span>
              <span className="text-stone-500">{user.role.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AuditTab() {
  const [entries, setEntries] = useState<Array<{ id: string; action: string; objectType: string; objectId: string | null; actor: { name: string } | null; createdAt: string; after: unknown }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (targetPage: number) => {
    const response = await fetch(`/api/audit?page=${targetPage}&pageSize=25`);
    if (!response.ok) return;
    const body = (await response.json()) as { data: typeof entries; meta: { total: number } };
    setEntries(body.data);
    setTotal(body.meta.total);
    setPage(targetPage);
  }, []);
  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Object</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}
                </td>
                <td className="px-3 py-2">{entry.actor?.name ?? "system"}</td>
                <td className="px-3 py-2 font-medium">{entry.action}</td>
                <td className="px-3 py-2 text-xs text-stone-500">
                  {entry.objectType}
                  {entry.objectId ? ` · …${entry.objectId.slice(-6)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>Page {page} · {total} entries</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => void load(page - 1)} className="rounded-md border border-stone-300 px-3 py-1.5 disabled:opacity-40">
            Previous
          </button>
          <button type="button" disabled={page * 25 >= total} onClick={() => void load(page + 1)} className="rounded-md border border-stone-300 px-3 py-1.5 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
