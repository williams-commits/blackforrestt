"use client";

import { useState } from "react";

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
        className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--bg-hover)]"
        title={`Send email to ${email}`}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
        Email
      </button>
      {open ? (
        <SendEmailModalLazy
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

// Inline lazy to avoid importing the modal until needed
import { SendEmailModal } from "@/components/SendEmailModal";
function SendEmailModalLazy(props: {
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";
  subjectId: string;
  toEmail: string | null;
  toName: string;
  onClose: () => void;
}) {
  return <SendEmailModal {...props} />;
}
