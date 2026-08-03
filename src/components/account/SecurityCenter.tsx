"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

interface SessionView {
  id: string;
  deviceName: string;
  lastSeenAt: string;
  revokedAt: string | null;
  current: boolean;
}

export function SecurityCenter() {
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const response = await fetch("/api/security/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (response.ok) toast.success("Session revoked");
    else toast.error("Unable to revoke session");
    await refresh();
  }

  async function revokeOthers() {
    setLoading(true);
    const response = await fetch("/api/security/sessions", { method: "POST" });
    const data = await response.json().catch(() => null) as { error?: string; revokedCount?: number } | null;
    setLoading(false);
    if (response.ok) toast.success("Sessions revoked", `${data?.revokedCount ?? 0} other session(s) revoked.`);
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

  return (
    <section className="space-y-4 rounded-lg border border-border bg-canvas p-6">
      <div>
        <h3 className="text-sm font-medium">Security center</h3>
        <p className="mt-1 text-[11px] text-text-faint">
          MFA: {enabled ? `enabled · ${remaining} recovery codes remaining` : "not enabled"}
        </p>
      </div>

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

      <div>
        <h4 className="mb-2 text-xs font-medium">Devices and sessions</h4>
        <Button type="button" size="sm" loading={loading} onClick={() => void revokeOthers()} className="mb-2">
          Revoke other sessions
        </Button>
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between rounded border border-border-soft p-2 text-xs">
              <span>
                {session.deviceName} {session.current ? "· current" : ""}
                <span className="block text-text-faint">Last seen {new Date(session.lastSeenAt).toLocaleString()}</span>
              </span>
              {!session.revokedAt && <Button type="button" size="sm" onClick={() => void revoke(session.id)}>Revoke</Button>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
