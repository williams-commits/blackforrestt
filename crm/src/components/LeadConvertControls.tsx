"use client";

import { Icon } from "@/components/Icon";

/** Success banner shown on a converted lead's detail page. */
export function LeadConvertedBanner({
  convertedAt,
  contactId,
  customerId,
}: {
  convertedAt: string;
  contactId: string | null;
  customerId: string | null;
}) {
  return (
    <div className="card flex items-center gap-3 p-4" aria-label="Lead converted">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--success-bg) text-(--success)">
        <Icon name="check_circle" size={16} />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">
          Converted on {new Date(convertedAt).toLocaleDateString()}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          This lead became{" "}
          {contactId ? (
            <a href={`/contacts/${contactId}`} className="font-medium text-foreground underline">
              a contact
            </a>
          ) : null}
          {contactId && customerId ? " and " : null}
          {customerId ? (
            <a href={`/customers/${customerId}`} className="font-medium text-foreground underline">
              a customer
            </a>
          ) : null}
          — its timeline, notes, and emails moved with it.
        </p>
      </div>
    </div>
  );
}
