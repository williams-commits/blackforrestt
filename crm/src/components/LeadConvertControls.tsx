"use client";

import { useState } from "react";
import { ConvertDialog } from "@/components/ConvertDialog";

/** "Convert" trigger + converted banner for the lead detail header. */
export function LeadConvertControls({
  leadId,
  convertedAt,
  convertedContactId,
  convertedCustomerId,
  canEdit,
}: {
  leadId: string;
  convertedAt: string | null;
  convertedContactId: string | null;
  convertedCustomerId: string | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (convertedAt) {
    return (
      <div className="rounded-md border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-3 py-2 text-sm">
        <p className="font-medium">Converted</p>
        <p className="text-xs text-stone-500">
          {new Date(convertedAt).toLocaleDateString()} →{" "}
          {convertedContactId ? (
            <a href={`/contacts/${convertedContactId}`} className="text-[var(--brand)] underline">
              contact
            </a>
          ) : null}
          {convertedCustomerId ? (
            <>
              {" · "}
              <a href={`/customers/${convertedCustomerId}`} className="text-[var(--brand)] underline">
                customer
              </a>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  if (!canEdit) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-3 py-1.5 text-sm font-semibold text-white"
        style={{ background: "var(--brand)" }}
      >
        Convert
      </button>
      {open ? <ConvertDialog leadId={leadId} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
