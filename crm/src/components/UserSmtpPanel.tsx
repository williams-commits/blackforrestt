"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Field, FormError, IconInput } from "@/components/form";
import { Switch } from "@/components/ui/switch";

/**
 * Admin panel: manage a user's personal SMTP credentials (per-user mail
 * sending) and jump to that user's mailbox view. The password is write-only —
 * it is encrypted at rest and never returned by the API.
 */

interface SmtpConfigView {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  fromName: string | null;
  fromAddress: string;
}

export function UserSmtpPanel({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [config, setConfig] = useState<SmtpConfigView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState(userEmail);
  const [busy, setBusy] = useState<"idle" | "saving" | "testing" | "removing">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/smtp`);
      const body = await response.json().catch(() => null);
      if (body?.data) {
        setConfig(body.data);
        setHost(body.data.host);
        setPort(String(body.data.port));
        setSecure(Boolean(body.data.secure));
        setUsername(body.data.username);
        setFromName(body.data.fromName ?? "");
        setFromAddress(body.data.fromAddress ?? userEmail);
      }
    } finally {
      setLoaded(true);
    }
  }, [userId, userEmail]);

  useEffect(() => { void load(); }, [load]);

  function payload() {
    return {
      host: host.trim(),
      port: Number(port),
      secure,
      username: username.trim(),
      ...(password ? { password } : {}),
      fromName: fromName.trim() || undefined,
      fromAddress: fromAddress.trim(),
    };
  }

  async function save() {
    setBusy("saving"); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/smtp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error ?? "Save failed."); return; }
      setNotice("SMTP settings saved — this user's email now sends through their own server.");
      setPassword("");
      await load();
    } finally {
      setBusy("idle");
    }
  }

  async function test() {
    setBusy("testing"); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/smtp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(password ? payload() : {}),
      });
      const body = await response.json().catch(() => null);
      if (body?.data?.ok) setNotice("✓ Connection verified.");
      else setError(body?.data?.error ? `Connection failed: ${body.data.error}` : "Connection failed.");
    } finally {
      setBusy("idle");
    }
  }

  async function remove() {
    setBusy("removing"); setError(null); setNotice(null);
    const response = await fetch(`/api/admin/users/${userId}/smtp`, { method: "DELETE" });
    if (response.ok) {
      setNotice("Override removed — this user falls back to the global SMTP settings.");
      setConfig(null); setHost(""); setPort("587"); setUsername(""); setPassword("");
      setFromName(""); setFromAddress(userEmail);
    } else {
      setError("Remove failed.");
    }
    setBusy("idle");
  }

  if (loaded && !config && !host) {
    // Still render the empty form — first-time setup for this user.
  }

  return (
    <div className="mt-4 border-t border-(--border-default) pt-4" data-testid="user-smtp-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-(--text-tertiary)">Personal SMTP (email sending identity)</p>
        <div className="flex items-center gap-2">
          <Link href={`/emails?userId=${userId}&userName=${encodeURIComponent(userEmail)}`} className="text-xs font-medium text-(--brand) hover:underline">
            View their emails →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-(--text-secondary)">
        When set, this user&#39;s outgoing email is sent through their own mail server. Without it, the global SMTP is used.
      </p>
      {notice ? <p role="status" className="mt-2 rounded-md bg-(--success-bg) px-3 py-2 text-sm text-(--success)">{notice}</p> : null}
      {error ? <div className="mt-2"><FormError message={error} /></div> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="SMTP host" id="smtp-host">
          <IconInput id="smtp-host" icon="plug" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" />
        </Field>
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <Field label="Port" id="smtp-port">
            <IconInput id="smtp-port" icon="plug" type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
          </Field>
          <label htmlFor="smtp-secure" className="flex items-end gap-2 pb-2 text-xs text-(--text-secondary)">
            <Switch id="smtp-secure" checked={secure} onCheckedChange={(checked) => setSecure(checked === true)} /> TLS/SSL
          </label>
        </div>
        <Field label="Username" id="smtp-username">
          <IconInput id="smtp-username" icon="users" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" placeholder="e.g. klaus@company.com" />
        </Field>
        <Field label="Password" id="smtp-password" help={config?.hasPassword ? "Saved — leave blank to keep the current password." : undefined}>
          <IconInput id="smtp-password" icon="shield" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••••" />
        </Field>
        <Field label="From name" id="smtp-from-name">
          <IconInput id="smtp-from-name" icon="users" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="e.g. Klaus Bergmann" />
        </Field>
        <Field label="From address" id="smtp-from-address">
          <IconInput id="smtp-from-address" icon="mail" type="email" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="e.g. klaus@company.com" />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" icon="check" loading={busy === "saving"} disabled={busy !== "idle" && busy !== "saving"} onClick={() => void save()}>
          Save SMTP
        </Button>
        <Button type="button" variant="secondary" size="sm" icon="plug" loading={busy === "testing"} disabled={(busy !== "idle" && busy !== "testing") || !host || !username} onClick={() => void test()}>
          Test connection
        </Button>
        {config ? (
          <Button type="button" variant="destructive" size="sm" icon="trash" loading={busy === "removing"} disabled={busy !== "idle" && busy !== "removing"} onClick={() => void remove()}>
            Remove override
          </Button>
        ) : null}
      </div>
    </div>
  );
}
