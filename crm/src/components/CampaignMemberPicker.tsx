"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";
import { SearchInput } from "@/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-(--border-default) p-3">
          <Select
            value={type}
            onValueChange={(value) => setType(value as typeof type)}
          >
            <SelectTrigger aria-label="Member type" className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="LEAD">Leads</SelectItem>
              <SelectItem value="CONTACT">Contacts</SelectItem>
              <SelectItem value="CUSTOMER">Customers</SelectItem>
            </SelectContent>
          </Select>
          <SearchInput
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
            wrapperClassName="min-w-52 flex-1"
          />
          <Button
            variant="secondary"
            onClick={() => void search()}
            disabled={busy}
          >
            Search
          </Button>
          {error ? <span className="text-sm text-(--error)">{error}</span> : null}
          {results.length > 0 ? (
            <ul className="w-full space-y-1">
              {results.map((result) => (
                <li key={result.id} className="flex items-center justify-between rounded border border-(--border-default) px-2 py-1 text-sm">
                  <span>{result.label}</span>
                  {existing.has(`${type}:${result.id}`) ? (
                    <span className="text-xs text-(--text-tertiary)">already a member</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void add(result.id)}
                      disabled={busy}
                      className="text-xs font-medium text-(--text-brand) hover:underline"
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

      {members.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add leads, contacts, or customers to start tracking this campaign."
        />
      ) : (
        <ul className="space-y-1">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between rounded border border-(--border-default) px-2 py-1 text-sm">
              <span>
                <Link href={`/${member.subjectType.toLowerCase()}s/${member.subjectId}`} className="text-(--text-brand) hover:underline">
                  {member.label}
                </Link>
                <span className="ml-2 text-xs text-(--text-tertiary)">{member.subjectType.toLowerCase()}</span>
              </span>
              <span className="flex items-center gap-2">
                {canEdit ? (
                  <Select
                    value={member.status}
                    disabled={busy}
                    onValueChange={(value) => void setStatus(member.id, value)}
                  >
                    <SelectTrigger size="sm" aria-label={`Status for ${member.label}`} className="h-auto w-auto py-0.5 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {MEMBER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-(--text-tertiary)">{member.status.toLowerCase()}</span>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void remove(member.id)}
                    disabled={busy}
                    className="text-xs text-(--error) hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
