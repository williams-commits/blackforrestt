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
        <p className="text-sm text-[var(--text-secondary)]">
          {canManage
            ? "Business configuration — changes are audit-logged."
            : "Read-only view — SETTINGS_MANAGE required for changes."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-default)] pb-2">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === entry.key ? "bg-[var(--brand)] text-white" : "border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]"
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

const inputClass = "rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm";

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
      {error ? <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">{error}</p> : null}
      {canManage ? (
        <form method="post" onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
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
          <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)" }}>
            Add
          </button>
        </form>
      ) : null}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
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
                    <button type="button" onClick={() => void remove(row.id)} className="text-xs text-[var(--error)] hover:underline">
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
      {error ? <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">{error}</p> : null}
      {canManage ? (
        <form method="post" onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div>
            <label htmlFor="t-name" className="mb-1 block text-xs font-medium">Name</label>
            <input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="t-color" className="mb-1 block text-xs font-medium">Color</label>
            <input id="t-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 rounded-md border border-[var(--border-strong)]" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)" }}>
            Add
          </button>
        </form>
      ) : null}
      <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No tags.</p>
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
      {error ? <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">{error}</p> : null}
      {canManage ? (
        <form method="post" onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
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
          <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)" }}>
            Add
          </button>
        </form>
      ) : null}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
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
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--text-tertiary)]">No custom fields defined.</td></tr>
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
                      <button type="button" onClick={() => void remove(row.id)} className="text-xs text-[var(--error)] hover:underline">
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

function PeopleTab({ canManage }: { canManage: boolean }) {
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
  const [uEmail, setUEmail] = useState("");
  const [uName, setUName] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uRole, setURole] = useState("REP");
  const [tName, setTName] = useState("");
  const [tLeader, setTLeader] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const usersResponse = await fetch("/api/admin/users");
    if (usersResponse.ok) setUsers((await usersResponse.json()).data);
    else setError("Loading users requires USERS_MANAGE.");
    const teamsResponse = await fetch("/api/admin/teams");
    if (teamsResponse.ok) setTeams((await teamsResponse.json()).data);
    const rolesResponse = await fetch("/api/admin/roles");
    if (rolesResponse.ok) setRoles((await rolesResponse.json()).data);
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
    <div className="space-y-4">
      {error ? <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">{error}</p> : null}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Users ({users.length})</p>
        {canManage ? (
          <button type="button" onClick={() => setShowUserForm((p) => !p)} className="btn btn-primary" style={{ background: "var(--brand)" }}>
            New user
          </button>
        ) : null}
      </div>
      {showUserForm && canManage ? (
        <form method="post" onSubmit={createUser} className="grid gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:grid-cols-5">
          <div>
            <label htmlFor="au-email" className="mb-1 block text-xs font-medium">Email *</label>
            <input id="au-email" type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="au-name" className="mb-1 block text-xs font-medium">Name *</label>
            <input id="au-name" value={uName} onChange={(e) => setUName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="au-pass" className="mb-1 block text-xs font-medium">Password * (10+)</label>
            <input id="au-pass" type="password" value={uPassword} onChange={(e) => setUPassword(e.target.value)} required minLength={10} className={inputClass} />
          </div>
          <div>
            <label htmlFor="au-role" className="mb-1 block text-xs font-medium">Role</label>
            <select id="au-role" value={uRole} onChange={(e) => setURole(e.target.value)} className={inputClass}>
              {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)" }}>Create</button>
          </div>
        </form>
      ) : null}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Teams</th>
              <th className="px-3 py-2 font-medium">Last login</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {canManage ? <th className="px-3 py-2 text-right font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-3 py-2"><p className="font-medium">{user.name}</p><p className="text-xs text-[var(--text-tertiary)]">{user.email}</p></td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select aria-label={`Role for ${user.name}`} value={user.role.key} onChange={(e) => void patchUser(user.id, { roleKey: e.target.value })} className={inputClass}>
                      {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                    </select>
                  ) : user.role.name}
                </td>
                <td className="px-3 py-2 text-xs">{user.memberships.map((m) => m.team.name).join(", ") || "—"}</td>
                <td className="px-3 py-2 text-xs">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "never"}</td>
                <td className="px-3 py-2">{user.status.toLowerCase()}</td>
                {canManage ? (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void patchUser(user.id, { status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}
                      className="text-xs text-[var(--brand)] hover:underline"
                    >
                      {user.status === "ACTIVE" ? "suspend" : "activate"}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Teams ({teams.length})</p>
        {canManage ? (
          <button type="button" onClick={() => setShowTeamForm((p) => !p)} className="btn btn-secondary">
            New team
          </button>
        ) : null}
      </div>
      {showTeamForm && canManage ? (
        <form method="post" onSubmit={createTeam} className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div>
            <label htmlFor="at-name" className="mb-1 block text-xs font-medium">Name *</label>
            <input id="at-name" value={tName} onChange={(e) => setTName(e.target.value)} required minLength={2} className={inputClass} />
          </div>
          <div>
            <label htmlFor="at-leader" className="mb-1 block text-xs font-medium">Leader</label>
            <select id="at-leader" value={tLeader} onChange={(e) => setTLeader(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)" }}>Create</button>
        </form>
      ) : null}
      <div className="grid gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id} className="rounded border border-[var(--border-default)] p-2 text-sm">
            <p className="font-medium">{team.name}{team.parent ? <span className="text-xs text-[var(--text-tertiary)]"> · under {team.parent.name}</span> : null}</p>
            <p className="text-xs text-[var(--text-secondary)]">lead {team.leader?.name ?? "—"} · {team.memberships.length} member(s): {team.memberships.map((m) => m.user.name).join(", ") || "none"}</p>
            {canManage ? (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Delete team “${team.name}”?`)) return;
                  const response = await fetch(`/api/admin/teams?id=${team.id}`, { method: "DELETE" });
                  if (!response.ok) {
                    const body = (await response.json().catch(() => null)) as { error?: string } | null;
                    setError(body?.error ?? "Delete failed.");
                    return;
                  }
                  void load();
                }}
                className="mt-1 text-xs text-[var(--error)] hover:underline"
              >
                delete
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function RolesTab() {
  const [roles, setRoles] = useState<Array<{
    id: string; key: string; name: string; description: string | null; isSystem: boolean;
    scope: string;
    permissions: Array<{ permission: string }>;
    _count: { users: number };
  }>>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/roles");
    if (!response.ok) {
      setError("Loading roles requires admin access.");
      return;
    }
    const body = (await response.json()) as { data: typeof roles; meta: { allPermissions: string[] } };
    setRoles(body.data);
    setAllPermissions(body.meta.allPermissions);
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

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">{error}</p> : null}
      {roles.map((role) => (
        <div key={role.id} className="card">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="font-medium">
              {role.name}
              <span className="ml-2 text-xs text-[var(--text-tertiary)]">scope {role.scope.toLowerCase()} · {role._count.users} user(s)</span>
            </p>
            {role.key === "SUPER_ADMIN" ? <span className="text-xs text-[var(--text-tertiary)]">permissions fixed</span> : null}
          </div>
          {role.description ? <p className="mb-2 text-xs text-[var(--text-secondary)]">{role.description}</p> : null}
          <div className="flex flex-wrap gap-1">
            {allPermissions.map((permission) => {
              const enabled = role.permissions.some((entry) => entry.permission === permission);
              const locked = role.key === "SUPER_ADMIN";
              return (
                <label key={permission} className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${enabled ? "border-[var(--brand)]/40 bg-[var(--brand)]/5" : "border-[var(--border-default)] text-[var(--text-tertiary)]"}`}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={locked}
                    onChange={(event) => void toggle(role.id, permission, event.target.checked)}
                  />
                  {permission}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<Array<{ id: string; key: string; value: unknown }>>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/settings");
    if (response.ok) setSettings((await response.json()).data);
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
      {error ? <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">{error}</p> : null}
      <form method="post" onSubmit={save} className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <div>
          <label htmlFor="set-key" className="mb-1 block text-xs font-medium">Key (e.g. org.currency)</label>
          <input id="set-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9_.]*" className={inputClass} />
        </div>
        <div>
          <label htmlFor="set-value" className="mb-1 block text-xs font-medium">Value</label>
          <input id="set-value" value={value} onChange={(e) => setValue(e.target.value)} required className={inputClass} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)" }}>Save</button>
      </form>
      <div className="card">
        {settings.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No settings yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {settings.map((setting) => (
              <li key={setting.id} className="flex justify-between">
                <span className="font-mono text-xs">{setting.key}</span>
                <span>{String(setting.value)}</span>
              </li>
            ))}
          </ul>
        )}
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
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
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
                <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                  {entry.objectType}
                  {entry.objectId ? ` · …${entry.objectId.slice(-6)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
        <span>Page {page} · {total} entries</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => void load(page - 1)} className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 disabled:opacity-40">
            Previous
          </button>
          <button type="button" disabled={page * 25 >= total} onClick={() => void load(page + 1)} className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}


function IntegrationsTab() {
  const [status, setStatus] = useState<{
    platformBridge: { enabled: boolean; url: string | null };
    email: { enabled: boolean; from: string | null };
  } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/integrations")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setStatus(body?.data ?? null))
      .catch(() => setStatus(null));
  }, []);

  if (!status) return <p className="text-sm text-[var(--text-tertiary)]">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Trading-platform bridge</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Read-only client-360: KYC, wallets, payments for linked customers.
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.platformBridge.enabled ? "bg-green-100 text-green-800" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}
          >
            {status.platformBridge.enabled ? "configured" : "not configured"}
          </span>
        </div>
        {status.platformBridge.url ? (
          <p className="mt-2 font-mono text-xs text-[var(--text-tertiary)]">{status.platformBridge.url}</p>
        ) : (
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">Set PLATFORM_BRIDGE_URL + PLATFORM_BRIDGE_TOKEN in the environment.</p>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Email notifications</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Assignment, task, overdue, and import notifications also go to email.
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.email.enabled ? "bg-green-100 text-green-800" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}
          >
            {status.email.enabled ? "configured" : "not configured"}
          </span>
        </div>
        {status.email.from ? (
          <p className="mt-2 font-mono text-xs text-[var(--text-tertiary)]">from: {status.email.from}</p>
        ) : (
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">Set SMTP_URL + SMTP_FROM in the environment.</p>
        )}
      </div>
    </div>
  );
}


function ObjectsTab() {
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

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/objects");
    if (response.ok) setObjects((await response.json()).data);
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
      {error ? <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">{error}</p> : null}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          Admin-defined record types (e.g. Properties, Vendors, Deals) — records are JSONB documents validated against each object&#39;s field schema.
        </p>
        <button type="button" onClick={() => setShowForm((p) => !p)} className="btn btn-primary" style={{ background: "var(--brand)" }}>
          New object type
        </button>
      </div>

      {showForm ? (
        <form method="post" onSubmit={create} className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
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
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
              Types: TEXT, NUMBER, CURRENCY, BOOLEAN, DATE, DATETIME, SELECT, MULTI_SELECT, PHONE, EMAIL, URL
            </p>
          </div>
          <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)" }}>Create</button>
        </form>
      ) : null}

      <div className="space-y-3">
        {objects.map((object) => (
          <div key={object.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">
                  {object.pluralName}
                  <span className="ml-2 font-mono text-xs text-[var(--text-tertiary)]">/{object.key}</span>
                  {!object.active ? <span className="ml-2 rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">inactive</span> : null}
                </p>
                {object.description ? <p className="text-xs text-[var(--text-secondary)]">{object.description}</p> : null}
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {object._count.records} record(s) · {object.fields?.length ?? 0} field(s):{" "}
                  {object.fields?.map((field) => field.label).join(", ") || "—"}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => void toggleActive(object.id, !object.active)} className="text-[var(--brand)] hover:underline">
                  {object.active ? "deactivate" : "activate"}
                </button>
                {object._count.records === 0 ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${object.pluralName}"?`)) return;
                      const response = await fetch(`/api/admin/objects/${object.id}`, { method: "DELETE" });
                      if (!response.ok) {
                        const body = (await response.json().catch(() => null)) as { error?: string } | null;
                        setError(body?.error ?? "Delete failed.");
                        return;
                      }
                      void load();
                    }}
                    className="text-[var(--error)] hover:underline"
                  >
                    delete
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {objects.length === 0 ? (
          <p className="card empty-state">
            No custom objects yet — create one above (e.g. Properties, Vendors).
          </p>
        ) : null}
      </div>
    </div>
  );
}
