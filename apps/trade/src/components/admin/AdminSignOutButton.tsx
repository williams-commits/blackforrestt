"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/Button";

/** Compact sign-out for the dark operations header. */
export function AdminSignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="text-down hover:text-down"
      disabled={busy}
      loading={busy}
      loadingLabel="Signing out"
      onClick={() => {
        setBusy(true);
        void signOut({ redirect: false }).then(() => { window.location.assign("/"); });
      }}
    >
      <LogOut size={13} strokeWidth={2} aria-hidden /> Sign out
    </Button>
  );
}
