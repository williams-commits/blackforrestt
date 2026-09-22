"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DuplicateHit } from "@/components/RecordForm";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { FormError } from "@/components/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface PreviewResponse {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  matches: { contacts: DuplicateHit[]; customers: DuplicateHit[] };
}

type ContactChoice =
  | { mode: "create" }
  | { mode: "link"; contactId: string };
type CustomerChoice =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "link"; customerId: string };
type AccountChoice =
  | { mode: "none" }
  | { mode: "create" };
type OpportunityChoice = { mode: "none" } | { mode: "create" };

/**
 * Lead conversion dialog: pre-flight duplicate matches are shown, then the
 * operator chooses create-new vs link-existing for contact and customer.
 */
export function ConvertDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [contactChoice, setContactChoice] = useState<ContactChoice>({ mode: "create" });
  const [customerChoice, setCustomerChoice] = useState<CustomerChoice>({ mode: "create" });
  const [accountChoice, setAccountChoice] = useState<AccountChoice>({ mode: "none" });
  const [opportunityChoice, setOpportunityChoice] = useState<OpportunityChoice>({ mode: "none" });
  const [force, setForce] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/leads/${leadId}/convert`);
      const body = (await response.json().catch(() => null)) as { data?: PreviewResponse; error?: string } | null;
      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Could not prepare conversion.");
        return;
      }
      setPreview(body.data);
      setAccountChoice(body.data.lead.company ? { mode: "create" } : { mode: "none" });
    })();
  }, [leadId]);

  async function convert() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: contactChoice,
          customer: customerChoice,
          account: accountChoice,
          opportunity: opportunityChoice,
          force,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { contactId: string | null; customerId: string | null };
        error?: string;
        details?: { matches?: unknown };
      } | null;
      if (response.status === 409 && body?.details) {
        setError(`${body.error ?? "Duplicates found."} Tick "create anyway" below to proceed.`);
        setForce(false);
        return;
      }
      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Conversion failed.");
        return;
      }
      router.push(body.data.contactId ? `/contacts/${body.data.contactId}` : "/leads");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Choice-card styling shared with the record merge modal — selected cards
  // get the ring border + selected background; idle cards invite with a hover.
  const choiceCard = (selected: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm transition-colors",
      selected ? "border-ring bg-(--bg-selected)" : "border-(--border-default) hover:border-ring",
    );

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-xl" showCloseButton={false} aria-describedby={undefined}>
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle>Convert lead</DialogTitle>
          <Button variant="tertiary" size="sm" className="w-7 px-0" onClick={onClose} aria-label="Close conversion dialog">
            <Icon name="close" size={16} />
          </Button>
        </DialogHeader>

        <FormError message={error} />

        {!preview ? (
          <p className="text-sm text-(--text-tertiary)">{error ? "" : "Checking for duplicates…"}</p>
        ) : (
          <>
            <p className="text-sm text-(--text-secondary)">
              Convert <strong>{preview.lead.firstName} {preview.lead.lastName}</strong>
              {preview.lead.company ? ` (${preview.lead.company})` : ""} into working records.
              Open tasks and notes follow the new contact automatically.
            </p>

            {preview.matches.contacts.length + preview.matches.customers.length > 0 ? (
              <div className="rounded-md border border-(--warning-border) bg-(--warning-bg) p-3 text-sm text-(--warning)">
                <p className="font-medium text-(--warning)">Possible existing records</p>
                <ul className="mt-1 space-y-1 text-amber-900">
                  {preview.matches.contacts.map((match) => (
                    <li key={match.id}>Contact: {match.label} (matches {match.matchOn.join(", ")})</li>
                  ))}
                  {preview.matches.customers.map((match) => (
                    <li key={match.id}>Customer: {match.label} (matches {match.matchOn.join(", ")})</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon name="users" size={14} className="text-(--text-tertiary)" />
                  Contact
                </p>
                <label className={choiceCard(contactChoice.mode === "create")}>
                  <input
                    type="radio"
                    name="contact-mode"
                    className="size-4"
                    checked={contactChoice.mode === "create"}
                    onChange={() => setContactChoice({ mode: "create" })}
                  />
                  Create new contact
                </label>
                {preview.matches.contacts.length > 0 ? (
                  <label className={choiceCard(contactChoice.mode === "link")}>
                    <input
                      type="radio"
                      name="contact-mode"
                      className="size-4"
                      checked={contactChoice.mode === "link"}
                      onChange={() =>
                        setContactChoice({ mode: "link", contactId: preview.matches.contacts[0]!.id })
                      }
                    />
                    Link existing: {preview.matches.contacts[0]!.label}
                    {preview.matches.contacts.length > 1
                      ? ` (+${preview.matches.contacts.length - 1} more)`
                      : ""}
                  </label>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon name="heart" size={14} className="text-(--text-tertiary)" />
                  Customer
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["none", "create"] as const).map((mode) => (
                    <label key={mode} className={choiceCard(customerChoice.mode === mode)}>
                      <input
                        type="radio"
                        name="customer-mode"
                        className="size-4"
                        checked={customerChoice.mode === mode}
                        onChange={() => setCustomerChoice({ mode } as CustomerChoice)}
                      />
                      {mode === "none" ? "Not now" : "Create customer"}
                    </label>
                  ))}
                  {preview.matches.customers.length > 0 ? (
                    <label className={choiceCard(customerChoice.mode === "link")}>
                      <input
                        type="radio"
                        name="customer-mode"
                        className="size-4"
                        checked={customerChoice.mode === "link"}
                        onChange={() =>
                          setCustomerChoice({ mode: "link", customerId: preview.matches.customers[0]!.id })
                        }
                      />
                      Link existing: {preview.matches.customers[0]!.label}
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon name="target" size={14} className="text-(--text-tertiary)" />
                  Opportunity
                </p>
                <div className="flex flex-wrap gap-2">
                  <label className={choiceCard(opportunityChoice.mode === "create")}>
                    <input
                      type="radio"
                      name="opp-mode"
                      className="size-4"
                      checked={opportunityChoice.mode === "create"}
                      onChange={() => setOpportunityChoice({ mode: "create" })}
                    />
                    Create in default pipeline
                  </label>
                  <label className={choiceCard(opportunityChoice.mode === "none")}>
                    <input
                      type="radio"
                      name="opp-mode"
                      className="size-4"
                      checked={opportunityChoice.mode === "none"}
                      onChange={() => setOpportunityChoice({ mode: "none" })}
                    />
                    Not now
                  </label>
                </div>
              </div>

              {preview.lead.company ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon name="building" size={14} className="text-(--text-tertiary)" />
                    Account
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className={choiceCard(accountChoice.mode === "create")}>
                      <input
                        type="radio"
                        name="account-mode"
                        className="size-4"
                        checked={accountChoice.mode === "create"}
                        onChange={() => setAccountChoice({ mode: "create" })}
                      />
                      Create “{preview.lead.company}”
                    </label>
                    <label className={choiceCard(accountChoice.mode === "none")}>
                      <input
                        type="radio"
                        name="account-mode"
                        className="size-4"
                        checked={accountChoice.mode === "none"}
                        onChange={() => setAccountChoice({ mode: "none" })}
                      />
                      Skip
                    </label>
                  </div>
                </div>
              ) : null}
            </div>

            {preview.matches.contacts.length > 0 || preview.matches.customers.length > 0 ? (
              <div className="flex items-center gap-2 text-sm text-(--text-secondary)">
                <Checkbox
                  id="convert-force"
                  checked={force}
                  onCheckedChange={(checked) => setForce(checked === true)}
                />
                <label htmlFor="convert-force" className="text-sm text-(--text-secondary)">
                  Create anyway despite the possible duplicates above
                </label>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-(--border-default) pt-4">
              <Button
                variant="secondary"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon="check"
                onClick={() => void convert()}
                loading={busy}
              >
                Convert
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
