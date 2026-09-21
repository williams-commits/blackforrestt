"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RECORD_UI, type ObjectKey, type RecordObjectKey } from "@/lib/recordUi";
import { RecordForm, type OptionSource } from "@/components/RecordForm";
import { useConfirmDialog } from "@/components/Dialogs";
import { Icon } from "@/components/Icon";

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
/** Record-status subject for the four record objects (campaigns/tasks have none). */
function isRecordObjectKey(value: ObjectKey): value is RecordObjectKey {
  return value === "leads" || value === "contacts" || value === "accounts" || value === "customers";
}

const subjectTypeMap: Record<RecordObjectKey, string> = {
          leads: "LEAD",
          contacts: "CONTACT",
          accounts: "ACCOUNT",
          customers: "CUSTOMER",
        };
        const subjectType = isRecordObjectKey(object) ? subjectTypeMap[object] : undefined;
        const statusUrl = `/api/record-statuses${subjectType ? `?subjectType=${subjectType}` : ""}`;
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
  const subjectType = object === "leads" ? "LEAD" : object === "contacts" ? "CONTACT" : object === "accounts" ? "ACCOUNT" : "CUSTOMER";
  const recordId = (row as { id: string }).id;

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
      <Link href={`/tasks?subjectType=${subjectType}&subjectId=${recordId}`} className="flex items-center gap-1.5 rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary)">
        Related tasks
      </Link>
      {canOpenActionForm ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:ring-offset-2 cursor-pointer"
        >
          <Icon name="edit" size={16} />
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
          <Icon name="trash" size={16} />
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
