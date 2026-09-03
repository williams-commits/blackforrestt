"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RECORD_UI, type ObjectKey } from "@/lib/recordUi";
import { RecordForm, type OptionSource } from "@/components/RecordForm";

const EMPTY: OptionSource = {
  leadStatuses: [],
  contactStatuses: [],
  customerStatuses: [],
  users: [],
  accounts: [],
  contacts: [],
};

/** Fresh buckets per fetch — spreading EMPTY would share (and mutate) its arrays. */
function freshOptions(): OptionSource {
  return {
    leadStatuses: [],
    contactStatuses: [],
    customerStatuses: [],
    users: [],
    accounts: [],
    contacts: [],
  };
}

/** Resolve dynamic select options (statuses, users, linked records). */
export function useOptionSources(object: ObjectKey): OptionSource {
  const [options, setOptions] = useState<OptionSource>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [statuses, users] = await Promise.all([
          fetch("/api/record-statuses").then((r) => (r.ok ? r.json() : { data: [] })),
          fetch("/api/users").then((r) => (r.ok ? r.json() : { data: [] })),
        ]);
        const next: OptionSource = freshOptions();
        for (const status of statuses.data as Array<{ id: string; name: string; appliesTo: string }>) {
          const key =
            status.appliesTo === "LEAD"
              ? "leadStatuses"
              : status.appliesTo === "CONTACT"
                ? "contactStatuses"
                : "customerStatuses";
          next[key].push({ value: status.id, label: status.name });
        }
        for (const user of users.data as Array<{ id: string; name: string }>) {
          next.users.push({ value: user.id, label: user.name });
        }
        if (object === "contacts" || object === "customers") {
          const accounts = await fetch("/api/accounts?pageSize=100").then((r) =>
            r.ok ? r.json() : { data: [] },
          );
          for (const account of accounts.data as Array<{ id: string; name: string }>) {
            next.accounts.push({ value: account.id, label: account.name });
          }
        }
        if (object === "customers") {
          const contacts = await fetch("/api/contacts?pageSize=100").then((r) =>
            r.ok ? r.json() : { data: [] },
          );
          for (const contact of contacts.data as Array<{
            id: string;
            firstName: string;
            lastName: string;
          }>) {
            next.contacts.push({ value: contact.id, label: `${contact.firstName} ${contact.lastName}` });
          }
        }
        if (!cancelled) setOptions(next);
      } catch {
        // Options are enhancement-only; forms still work without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [object]);
  return options;
}

/** Edit + delete controls for a record detail page. */
export function RecordDetailActions({
  object,
  row,
  canEdit,
  canDelete,
}: {
  object: ObjectKey;
  row: Record<string, unknown>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const options = useOptionSources(object);

  if (!canEdit && !canDelete) return null;

  async function handleDelete() {
    if (!window.confirm("Delete this record?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/${object}/${(row as { id: string }).id}`, { method: "DELETE" });
      if (response.ok) router.push(`/${object}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
        >
          Edit
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      ) : null}
      {editing ? (
        <RecordForm
          object={object}
          fields={RECORD_UI[object].fields}
          options={options}
          initial={row}
          onSaved={() => router.refresh()}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
