"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  source: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  owner: { id: string; name: string } | null;
  memberCount: number;
}

export function CampaignsPage({ canCreate }: { canCreate: boolean }) {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) setRows((await response.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCampaign(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        source: source || null,
        status,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create campaign.");
      return;
    }
    setShowForm(false);
    setName("");
    setDescription("");
    setSource("");
    setStatus("DRAFT");
    void load();
  }

  const inputClass =
    "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Campaigns</h1>
          <p className="text-sm text-stone-500">{rows.length} campaign(s)</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setShowForm((previous) => !previous)}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-white"
            style={{ background: "var(--brand)" }}
          >
            New campaign
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form method="post" onSubmit={createCampaign} className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-4">
          {error ? (
            <p role="alert" className="sm:col-span-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div>
            <label htmlFor="c-name" className="mb-1 block text-sm font-medium">Name *</label>
            <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className={inputClass} />
          </div>
          <div>
            <label htmlFor="c-source" className="mb-1 block text-sm font-medium">Source</label>
            <input id="c-source" value={source} onChange={(e) => setSource(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="c-status" className="mb-1 block text-sm font-medium">Status</label>
            <select id="c-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div>
            <label htmlFor="c-desc" className="mb-1 block text-sm font-medium">Description</label>
            <input id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
              Create
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2 font-medium">Campaign</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Members</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Window</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-stone-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-stone-400">No campaigns yet.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">
                    <Link href={`/campaigns/${row.id}`} className="font-medium text-[var(--brand)] hover:underline">
                      {row.name}
                    </Link>
                    {row.description ? <p className="text-xs text-stone-400">{row.description}</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium">{row.status.toLowerCase()}</span>
                  </td>
                  <td className="px-3 py-2">{row.source ?? "—"}</td>
                  <td className="px-3 py-2">{row.memberCount}</td>
                  <td className="px-3 py-2">{row.owner?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {row.startsAt ? new Date(row.startsAt).toLocaleDateString() : "—"}
                    {row.endsAt ? ` → ${new Date(row.endsAt).toLocaleDateString()}` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
