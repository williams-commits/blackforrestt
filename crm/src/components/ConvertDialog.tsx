"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DuplicateHit } from "@/components/RecordForm";

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

  const radio = "mr-1";
  const card = "rounded-md border border-stone-200 p-3";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold">Convert lead</h2>

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {!preview ? (
          <p className="text-sm text-stone-400">{error ? "" : "Checking for duplicates…"}</p>
        ) : (
          <>
            <p className="text-sm text-stone-600">
              Convert <strong>{preview.lead.firstName} {preview.lead.lastName}</strong>
              {preview.lead.company ? ` (${preview.lead.company})` : ""} into working records.
              Open tasks and notes follow the new contact automatically.
            </p>

            {preview.matches.contacts.length + preview.matches.customers.length > 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-800">Possible existing records</p>
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
              <div className={card}>
                <p className="mb-2 text-sm font-medium">Contact</p>
                <label className="mr-4 text-sm">
                  <input
                    type="radio"
                    name="contact-mode"
                    className={radio}
                    checked={contactChoice.mode === "create"}
                    onChange={() => setContactChoice({ mode: "create" })}
                  />
                  Create new contact
                </label>
                {preview.matches.contacts.length > 0 ? (
                  <label className="text-sm">
                    <input
                      type="radio"
                      name="contact-mode"
                      className={radio}
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

              <div className={card}>
                <p className="mb-2 text-sm font-medium">Customer</p>
                {(["none", "create"] as const).map((mode) => (
                  <label key={mode} className="mr-4 text-sm">
                    <input
                      type="radio"
                      name="customer-mode"
                      className={radio}
                      checked={customerChoice.mode === mode}
                      onChange={() => setCustomerChoice({ mode } as CustomerChoice)}
                    />
                    {mode === "none" ? "Not now" : "Create customer"}
                  </label>
                ))}
                {preview.matches.customers.length > 0 ? (
                  <label className="text-sm">
                    <input
                      type="radio"
                      name="customer-mode"
                      className={radio}
                      checked={customerChoice.mode === "link"}
                      onChange={() =>
                        setCustomerChoice({ mode: "link", customerId: preview.matches.customers[0]!.id })
                      }
                    />
                    Link existing: {preview.matches.customers[0]!.label}
                  </label>
                ) : null}
              </div>

              <div className={card}>
                <p className="mb-2 text-sm font-medium">Opportunity</p>
                <label className="mr-4 text-sm">
                  <input
                    type="radio"
                    name="opp-mode"
                    className={radio}
                    checked={opportunityChoice.mode === "create"}
                    onChange={() => setOpportunityChoice({ mode: "create" })}
                  />
                  Create in default pipeline
                </label>
                <label className="text-sm">
                  <input
                    type="radio"
                    name="opp-mode"
                    className={radio}
                    checked={opportunityChoice.mode === "none"}
                    onChange={() => setOpportunityChoice({ mode: "none" })}
                  />
                  Not now
                </label>
              </div>

              {preview.lead.company ? (
                <div className={card}>
                  <p className="mb-2 text-sm font-medium">Account</p>
                  <label className="mr-4 text-sm">
                    <input
                      type="radio"
                      name="account-mode"
                      className={radio}
                      checked={accountChoice.mode === "create"}
                      onChange={() => setAccountChoice({ mode: "create" })}
                    />
                    Create “{preview.lead.company}”
                  </label>
                  <label className="text-sm">
                    <input
                      type="radio"
                      name="account-mode"
                      className={radio}
                      checked={accountChoice.mode === "none"}
                      onChange={() => setAccountChoice({ mode: "none" })}
                    />
                    Skip
                  </label>
                </div>
              ) : null}
            </div>

            {preview.matches.contacts.length > 0 || preview.matches.customers.length > 0 ? (
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(event) => setForce(event.target.checked)}
                />
                Create anyway despite the possible duplicates above
              </label>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void convert()}
                disabled={busy}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand)" }}
              >
                {busy ? "Converting…" : "Convert"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
