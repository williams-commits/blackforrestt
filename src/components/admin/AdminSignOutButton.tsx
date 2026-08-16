"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/** Compact sign-out for the admin header. */
export function AdminSignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut({ callbackUrl: "/" });
      }}
      className="rounded border border-border px-2.5 py-1 text-[11px] font-medium text-text-muted transition hover:border-down/40 hover:text-down disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
