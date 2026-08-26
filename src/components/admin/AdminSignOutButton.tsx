"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/** Compact sign-out for the dark operations header. */
export function AdminSignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut({ redirect: false }).then(() => { window.location.assign("/"); });
      }}
      className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
