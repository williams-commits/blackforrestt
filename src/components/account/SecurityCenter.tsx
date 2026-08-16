"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/lib/toast";

interface SessionView {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  deviceType: string;
  createdAt: string;
  lastSeenAt: string;
  mfaVerifiedAt: string | null;
  current: boolean;
}

/** Compact relative-time formatter: "Active now", "5 min ago", "3 days ago". */
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Active now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return `${Math.floor(diff / 86_400_000)} days ago`;
}

/** Distinct colour per browser for the icon circle. */
const BROWSER_COLORS: Record<string, string> = {
  Chrome: "#4285F4",
  Safari: "#1B88CA",
  Firefox: "#E66000",
  Edge: "#0078D7",
  Opera: "#FF1B2D",
  Chromium: "#4285F4",
};

function BrowserIcon({ browser }: { browser: string }) {
  const color = BROWSER_COLORS[browser] ?? "#9aa5b1";
  const letter = browser === "Unknown" ? "🌐" : browser[0];
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ background: color }}
    >
      {letter}
    </span>
  );
}

export function SecurityCenter() {
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [mfaResponse, sessionsResponse] = await Promise.all([
      fetch("/api/security/mfa"),
      fetch("/api/security/sessions"),
    ]);
    if (mfaResponse.ok) {
      const data = await mfaResponse.json() as { enabled: boolean; recoveryCodesRemaining: number };
      setEnabled(data.enabled);
      setRemaining(data.recoveryCodesRemaining);
    }
    if (sessionsResponse.ok) {
      const data = await sessionsResponse.json() as { sessions: SessionView[] };
      setSessions(data.sessions);
    }
    // Mark loaded either way so the empty state is truthful, never a flash.
    setSessionsLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnrollment() {
    setLoading(true);
    setNotice(null);
    const response = await fetch("/api/security/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: password }),
    });
    const data = await response.json().catch(() => null) as { error?: string; secret?: string } | null;
    setLoading(false);
    if (!response.ok || !data?.secret) {
      toast.error("MFA enrollment failed", data?.error ?? "Unable to start MFA enrollment.");
      return;
    }
    setSecret(data.secret);
    setNotice("Add the secret to your authenticator, then enter its six-digit code.");
  }

  async function confirmEnrollment() {
    setLoading(true);
    const response = await fetch("/api/security/mfa", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await response.json().catch(() => null) as {
      error?: string;
      recoveryCodes?: string[];
    } | null;
    setLoading(false);
    if (!response.ok || !data?.recoveryCodes) {
      toast.error("MFA confirmation failed", data?.error ?? "MFA confirmation failed.");
      return;
    }
    setRecoveryCodes(data.recoveryCodes);
    setSecret(null);
    setPassword("");
    setCode("");
    toast.success("MFA enabled", "Store these recovery codes now; they are shown only once.");
    await refresh();
  }

  async function revoke(sessionId: string) {
    setRevokingId(sessionId);
    const response = await fetch("/api/security/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setRevokingId(null);
    if (response.ok) toast.success("Session revoked", "That device has been signed out.");
    else toast.error("Unable to revoke session");
    await refresh();
  }

  async function revokeOthers() {
    setLoading(true);
    const response = await fetch("/api/security/sessions", { method: "POST" });
    const data = await response.json().catch(() => null) as { error?: string; revokedCount?: number } | null;
    setLoading(false);
    if (response.ok) toast.success("Sessions revoked", `${data?.revokedCount ?? 0} other device(s) signed out.`);
    else toast.error("Unable to revoke sessions", data?.error ?? "Unable to revoke other sessions.");
    await refresh();
  }

  async function disableMfa() {
    setLoading(true);
    const response = await fetch("/api/security/mfa", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: password, code }),
    });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    setLoading(false);
    if (!response.ok) {
      toast.error("Unable to disable MFA", data?.error ?? "Unable to disable MFA.");
      return;
    }
    setPassword("");
    setCode("");
    setRecoveryCodes([]);
    toast.info("MFA disabled", "Other sessions were revoked.");
    await refresh();
  }

  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <section className="space-y-5 rounded-lg border border-border bg-canvas p-6">
      {/* ── Header ── */}
      <div>
        <h3 className="text-sm font-medium">Security center</h3>
        <p className="mt-1 text-[11px] text-text-faint">
          MFA: {enabled ? `enabled · ${remaining} recovery codes remaining` : "not enabled"}
        </p>
      </div>

      {/* ── MFA enrollment ── */}
      {!enabled && !secret && (
        <div className="flex gap-2">
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Current password" aria-label="Current password for MFA enrollment" className="h-10 flex-1 rounded border border-border bg-canvas px-3 text-sm" />
          <Button type="button" variant="sell" loading={loading} onClick={() => void startEnrollment()}>Start MFA setup</Button>
        </div>
      )}
      {secret && (
        <div className="space-y-3 rounded border border-brand/30 bg-brand-soft p-3">
          <p className="break-all font-mono text-xs">{secret}</p>
          <div className="flex gap-2">
            <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Six-digit code" aria-label="Authenticator code" className="h-10 flex-1 rounded border border-border bg-canvas px-3 text-sm" />
            <Button type="button" loading={loading} onClick={() => void confirmEnrollment()}>Enable MFA</Button>
          </div>
        </div>
      )}
      {recoveryCodes.length > 0 && (
        <ul className="grid grid-cols-2 gap-1 rounded border border-up/30 bg-up/10 p-3 font-mono text-xs">
          {recoveryCodes.map((recoveryCode) => <li key={recoveryCode}>{recoveryCode}</li>)}
        </ul>
      )}
      {enabled && (
        <div className="space-y-3 rounded border border-border-soft p-3">
          <p className="text-xs text-text-muted">
            Disabling MFA requires your password and an authenticator or recovery code.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Current password" autoComplete="current-password" aria-label="Current password for disabling MFA" className="h-10 rounded border border-border bg-canvas px-3 text-sm" />
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Authenticator or recovery code" autoComplete="one-time-code" aria-label="MFA code for disabling MFA" className="h-10 rounded border border-border bg-canvas px-3 text-sm" />
          </div>
          <Button type="button" loading={loading} onClick={() => void disableMfa()}>Disable MFA</Button>
        </div>
      )}
      {notice && <p role="status" className="text-xs text-text-muted">{notice}</p>}

      {/* ── Active sessions ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-text">Active sessions</h4>
            <p className="text-[11px] text-text-faint">
              {sessions.length} device{sessions.length === 1 ? "" : "s"} signed in
            </p>
          </div>
          {otherCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="sell"
              loading={loading}
              onClick={() => void revokeOthers()}
            >
              Sign out all others ({otherCount})
            </Button>
          )}
        </div>

        {!sessionsLoaded ? (
          <div className="space-y-2" role="status" aria-label="Loading sessions">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-panel p-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-border-soft bg-panel p-4 text-center">
            <p className="text-xs text-text-muted">No active sessions found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                  session.current
                    ? "border-brand/30 bg-brand-soft/20"
                    : "border-border bg-panel hover:border-brand/30"
                }`}
              >
                <BrowserIcon browser={session.browser} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-text">
                      {session.browser === "Unknown" && session.os === "Unknown"
                        ? session.deviceName
                        : `${session.browser} on ${session.os}`}
                    </span>
                    {session.current && (
                      <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                        This device
                      </span>
                    )}
                    {session.mfaVerifiedAt && !session.current && (
                      <span className="shrink-0 rounded-full bg-up/10 px-1.5 py-0.5 text-[9px] font-semibold text-up">
                        MFA
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-faint">
                    <span>{formatRelative(session.lastSeenAt)}</span>
                    <span className="text-border">·</span>
                    <span className="capitalize">{session.deviceType}</span>
                  </div>
                </div>

                {!session.current && (
                  <button
                    type="button"
                    onClick={() => void revoke(session.id)}
                    disabled={revokingId === session.id}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-text-muted transition hover:border-down/40 hover:text-down disabled:opacity-50"
                  >
                    {revokingId === session.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
