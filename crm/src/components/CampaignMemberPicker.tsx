"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MemberRow {
  id: string;
  subjectType: string;
  subjectId: string;
  label: string;
  status: string;
}

const MEMBER_STATUSES = ["MEMBER", "RESPONDED", "QUALIFIED", "CONVERTED"] as const;

/** Add/remove campaign members: pick a type, search, click to add. */
export function CampaignMemberPicker({
  campaignId,
  canEdit,
  members,
}: {
  campaignId: string;
  canEdit: boolean;
  members: MemberRow[];
}) {
  const router = useRouter();
  const [type, setType] = useState<"LEAD" | "CONTACT" | "CUSTOMER">("LEAD");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = new Set(members.map((member) => `${member.subjectType}:${member.subjectId}`));

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const endpoint = type === "LEAD" ? "leads" : type === "CONTACT" ? "contacts" : "customers";
      const response = await fetch(`/api/${endpoint}?q=${encodeURIComponent(query)}&pageSize=10`);
      if (!response.ok) {
        setError("Search failed.");
        return;
      }
      const body = (await response.json()) as {
        data: Array<{ id: string; firstName?: string; lastName?: string; name?: string }>;
      };
      setResults(
        body.data.map((row) => ({
          id: row.id,
          label: row.name ?? `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
        })),
      );
    } finally {
      setBusy(false);
    }
  }

  async function add(subjectId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType: type, subjectId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not add member.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(memberId: string, status: string) {
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(memberId: string) {
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[--border-default] p-3">
          <select
            aria-label="Member type"
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
            className="input"
          >
            <option value="LEAD">Leads</option>
            <option value="CONTACT">Contacts</option>
            <option value="CUSTOMER">Customers</option>
          </select>
          <input
            aria-label="Search records"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            placeholder="Search by name or email…"
            className="min-w-52 flex-1 rounded-md border border-[--border-strong] px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={busy}
            className="btn btn-secondary"
          >
            Search
          </button>
          {error ? <span className="text-sm text-[--error]">{error}</span> : null}
          {results.length > 0 ? (
            <ul className="w-full space-y-1">
              {results.map((result) => (
                <li key={result.id} className="flex items-center justify-between rounded border border-[--border-default] px-2 py-1 text-sm">
                  <span>{result.label}</span>
                  {existing.has(`${type}:${result.id}`) ? (
                    <span className="text-xs text-[--text-tertiary]">already a member</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void add(result.id)}
                      disabled={busy}
                      className="text-xs font-medium text-[--brand] hover:underline"
                    >
                      Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-1">
        {members.length === 0 ? (
          <li className="text-sm text-[--text-tertiary]">No members yet.</li>
        ) : (
          members.map((member) => (
            <li key={member.id} className="flex items-center justify-between rounded border border-[--border-default] px-2 py-1 text-sm">
              <span>
                <a href={`/${member.subjectType.toLowerCase()}s/${member.subjectId}`} className="text-[--brand] hover:underline">
                  {member.label}
                </a>
                <span className="ml-2 text-xs text-[--text-tertiary]">{member.subjectType.toLowerCase()}</span>
              </span>
              <span className="flex items-center gap-2">
                {canEdit ? (
                  <select
                    aria-label={`Status for ${member.label}`}
                    value={member.status}
                    disabled={busy}
                    onChange={(event) => void setStatus(member.id, event.target.value)}
                    className="rounded border border-[--border-default] px-1 py-0.5 text-xs"
                  >
                    {MEMBER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-[--text-tertiary]">{member.status.toLowerCase()}</span>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void remove(member.id)}
                    disabled={busy}
                    className="text-xs text-[--error] hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
