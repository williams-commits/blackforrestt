"use client";

import { useState } from "react";
import { EmailCompose } from "@/components/EmailCompose";
import { Icon } from "@/components/Icon";

/** "Send Email" trigger button — shown on record pages with an email. */
export function SendEmailButton({
  subjectType,
  subjectId,
  email,
  name,
}: {
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";
  subjectId: string;
  email: string | null;
  name: string;
}) {
  const [open, setOpen] = useState(false);

  if (!email) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-medium hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:ring-offset-2 cursor-pointer"
        title={`Send email to ${email}`}
      >
        <Icon name="mail" size={16} />
        Email
      </button>
      {open ? (
        <EmailCompose
          subjectType={subjectType}
          subjectId={subjectId}
          toEmail={email}
          toName={name}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
