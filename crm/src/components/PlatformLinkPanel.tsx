"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PlatformUser {
  platformUserId: string;
  email: string | null;
  name: string | null;
  registeredAt: string;
  emailVerified: boolean;
}

type LookupState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "missing"; reason: string }
  | { status: "found"; user: PlatformUser };

/**
 * Operator-confirmed platform linking: look up the platform user by the
 * customer's email, show BOTH sides, and link only on explicit confirm.
 */
export function PlatformLinkPanel({
  customerId,
  customerEmail,
  canEdit,
}: {
  customerId: string;
  customerEmail: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runLookup() {
    if (!customerEmail) {
      setError("This customer has no email to match against.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/platform/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customerEmail }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { found: boolean; reason?: string; user?: PlatformUser };
        error?: string;
      } | null;
      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Lookup failed.");
        return;
      }
      const result = body.data;
      if (result.found && result.user) {
        setLookup({ status: "found", user: result.user });
      } else {
        setLookup({
          status: "missing",
          reason:
            result.reason === "not-found"
              ? "No platform user with this email."
              : "Platform bridge unavailable.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    if (lookup.status !== "found") return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customerId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformUserId: lookup.user.platformUserId,
          confirmedEmail: lookup.user.email ?? customerEmail,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Link failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">
        Not linked. Matching is by email and confirmed by you — nothing is linked automatically.
      </p>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          onClick={() => void runLookup()}
          disabled={busy}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
        >
          {busy ? "Checking…" : `Look up platform user by ${customerEmail ?? "email"}`}
        </button>
      ) : null}
      {lookup.status === "missing" ? (
        <p className="text-sm text-amber-700">{lookup.reason}</p>
      ) : null}
      {lookup.status === "found" ? (
        <div className="space-y-2 rounded-md border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-3 text-sm">
          <p className="font-medium">Platform user found</p>
          <ul className="space-y-0.5 text-stone-600">
            <li>Name: {lookup.user.name ?? "—"}</li>
            <li>Email: {lookup.user.email}</li>
            <li>Registered: {new Date(lookup.user.registeredAt).toLocaleDateString()}</li>
            <li>Email verified: {lookup.user.emailVerified ? "yes" : "no"}</li>
          </ul>
          <button
            type="button"
            onClick={() => void link()}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand)" }}
          >
            Link this platform user
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Unlink control for an already-linked customer. */
export function PlatformUnlinkButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Unlink this customer from the platform user?")) return;
        setBusy(true);
        try {
          await fetch(`/api/customers/${customerId}/link`, { method: "DELETE" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      Unlink
    </button>
  );
}
