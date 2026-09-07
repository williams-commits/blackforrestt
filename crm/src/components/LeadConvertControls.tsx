"use client";

import { useState } from "react";
import { ConvertDialog } from "@/components/ConvertDialog";

/** "Convert" trigger + converted banner for the lead detail header. */
export function LeadConvertControls({
  leadId,
  convertedAt,
  convertedContactId,
  convertedCustomerId,
  canConvert,
}: {
  leadId: string;
  convertedAt: string | null;
  convertedContactId: string | null;
  convertedCustomerId: string | null;
  canConvert: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (convertedAt) {
    return (
      <div className="rounded-md border border-(--brand)/30 bg-(--brand)/5 px-3 py-2 text-sm">
        <p className="font-medium">Converted</p>
        <p className="text-xs text-(--text-secondary)">
          {new Date(convertedAt).toLocaleDateString()} →{" "}
          {convertedContactId ? (
            <a href={`/contacts/${convertedContactId}`} className="text-(--brand) underline">
              contact
            </a>
          ) : null}
          {convertedCustomerId ? (
            <>
              {" · "}
              <a href={`/customers/${convertedCustomerId}`} className="text-(--brand) underline">
                customer
              </a>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  if (!canConvert) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        style={{ background: "var(--brand)" }}
      >
        Convert
      </button>
      {open ? <ConvertDialog leadId={leadId} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
