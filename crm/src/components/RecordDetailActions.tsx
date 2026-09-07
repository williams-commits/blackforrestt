"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RECORD_UI, type ObjectKey } from "@/lib/recordUi";
import { RecordForm, type OptionSource } from "@/components/RecordForm";
import { useConfirmDialog } from "@/components/Dialogs";

const EMPTY: OptionSource = {
  leadStatuses: [],
  accountStatuses: [],
  potentialStatuses: [],
  contactStatuses: [],
  customerStatuses: [],
  users: [],
  accounts: [],
  contacts: [],
  campaigns: [],
};

/** Fresh buckets per fetch — spreading EMPTY would share (and mutate) its arrays. */
function freshOptions(): OptionSource {
  return {
    leadStatuses: [],
    accountStatuses: [],
    potentialStatuses: [],
    contactStatuses: [],
    customerStatuses: [],
    users: [],
    accounts: [],
    contacts: [],
    campaigns: [],
  };
}

/** Resolve dynamic select options (statuses, users, linked records). */
export function useOptionSources(object: ObjectKey): OptionSource {
  const [options, setOptions] = useState<OptionSource>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const subjectTypeMap: Record<ObjectKey, string> = {
          leads: "LEAD",
          contacts: "CONTACT",
          accounts: "ACCOUNT",
          customers: "CUSTOMER",
        };
        const subjectType = subjectTypeMap[object];
        const statusUrl = subjectType ? `/api/record-statuses?subjectType=${subjectType}` : "/api/record-statuses";
        const [me, statuses, users] = await Promise.all([
          fetch("/api/me").then((r) => (r.ok ? r.json() : { data: { permissions: [] } })),
          fetch(statusUrl).then((r) => (r.ok ? r.json() : { data: [] })),
          fetch("/api/users").then((r) => (r.ok ? r.json() : { data: [] })),
        ]);
        const potentialStatuses = object === "leads"
          ? await fetch("/api/potential-statuses?subjectType=LEAD").then((r) => (r.ok ? r.json() : { data: [] }))
          : { data: [] as Array<{ id: string; name: string }> };
        const next: OptionSource = freshOptions();
        for (const status of potentialStatuses.data as Array<{ id: string; name: string }>) {
          next.potentialStatuses.push({ value: status.id, label: status.name });
        }
        for (const status of statuses.data as Array<{ id: string; name: string; appliesTo: string }>) {
          const key =
            status.appliesTo === "LEAD"
              ? "leadStatuses"
              : status.appliesTo === "ACCOUNT"
                ? "accountStatuses"
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
        if ((object === "leads" || object === "contacts" || object === "customers") && (me.data?.permissions as string[] | undefined)?.includes("CAMPAIGNS_VIEW")) {
          const campaigns = await fetch("/api/campaigns").then((r) => (r.ok ? r.json() : { data: [] }));
          for (const campaign of campaigns.data as Array<{ id: string; name: string }>) {
            next.campaigns.push({ value: campaign.id, label: campaign.name });
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
  canAssign = false,
  canChangeStatus = false,
  canChangePotentialStatus = false,
}: {
  object: ObjectKey;
  row: Record<string, unknown>;
  canEdit: boolean;
  canDelete: boolean;
  canAssign?: boolean;
  canChangeStatus?: boolean;
  canChangePotentialStatus?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const options = useOptionSources(object);

  const canOpenActionForm = canEdit || canAssign || canChangeStatus || canChangePotentialStatus;
  if (!canOpenActionForm && !canDelete) return null;

  async function handleDelete() {
    const singular = RECORD_UI[object].singular.toLowerCase();
    const ok = await confirm({
      title: `Delete this ${singular}?`,
      message: `This ${singular} will be soft-deleted. This can be undone only by an administrator.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
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
      {canOpenActionForm ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:ring-offset-2 cursor-pointer"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
            <path
              fillRule="evenodd"
              d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
              clipRule="evenodd"
            />
          </svg>
          {canEdit ? "Edit" : "Manage actions"}
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:ring-offset-2 cursor-pointer"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
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
          canEdit={canEdit}
        />
      ) : null}

      {confirmDialog}
    </div>
  );
}
