"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { PASSWORD_MIN_LENGTH, isValidPassword } from "@/lib/passwordPolicy";
import { SecurityCenter } from "./SecurityCenter";
import { fmtDate } from "@/lib/dates";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleDialog as Dialog } from "@/components/ui/Dialog";
import { Check, KeyRound, Lock, Pencil, ShieldCheck, User, X } from "lucide-react";
import { IdentityTile, initialsOf } from "@/components/ui/Initial";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  name: string;
  email: string;
  accountNo: string;
  createdAt: string;
  verified: boolean;
}

type Notice = { kind: "ok" | "err"; text: string } | null;

async function readJson(response: Response): Promise<{ error?: string }> {
  try {
    return (await response.json()) as { error?: string };
  } catch {
    return {};
  }
}

/** Settings — a details Card (who you are) with profile and password edits
 *  behind modals, plus the security center. */
export function SettingsTab({ user }: { user: User }) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* Account details */}
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Your identity on the platform.</CardDescription>
          <CardAction className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
              <Pencil size={13} strokeWidth={2} aria-hidden /> Edit profile
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
              <KeyRound size={13} strokeWidth={2} aria-hidden /> Change password
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 pb-5">
            <IdentityTile size="lg" tone="brand" className="size-14 text-lg font-semibold">
              {initialsOf(user.name || user.email)}
            </IdentityTile>
            <div className="min-w-0">
              <div className="text-base font-semibold">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
            {user.verified ? (
              <Badge variant="secondary" className="bg-(--term-success-bg) text-(--term-success-fg)">
                <ShieldCheck size={11} strokeWidth={2} aria-hidden /> Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-(--term-danger-bg) text-(--term-danger-fg)">Unverified</Badge>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <DetailRow label="Display name" value={user.name} />
            <DetailRow label="Email" value={user.email} />
            <DetailRow label="Account number" value={<span className="font-mono">{user.accountNo}</span>} />
            <DetailRow label="Member since" value={fmtDate(user.createdAt)} />
          </dl>
        </CardContent>
      </Card>

      <SecurityCenter />

      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} user={user} onSaved={() => router.refresh()} />
      <PasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

function ProfileDialog({ open, onClose, user, onSaved }: { open: boolean; onClose: () => void; user: User; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setNotice(null);
    }
  }, [open, user.name]);

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setNotice(null);
    const normalizedName = name.trim();
    if (!normalizedName) {
      setNotice({ kind: "err", text: "Name cannot be empty." });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setNotice({ kind: "err", text: data.error ?? "Failed to update profile." });
        return;
      }
      setNotice({ kind: "ok", text: "Profile updated." });
      onSaved();
      onClose();
    } catch {
      setNotice({ kind: "err", text: "Network error while updating the profile." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Edit profile" description="Update how your name appears across the platform." className="sm:max-w-md">
      <form onSubmit={save} className="space-y-4 px-5 py-4">
        <Field
          label="Display name"
          type="text"
          icon={<User size={13} strokeWidth={2} />}
          value={name}
          onChange={(value) => { setName(value); setNotice(null); }}
          autoComplete="name"
          maxLength={100}
        />
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Email</label>
          <Input value={user.email} readOnly aria-readonly="true" className="cursor-default truncate text-muted-foreground" />
        </div>
        {notice && <Alert tone={notice.kind}>{notice.text}</Alert>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}><X size={13} strokeWidth={2} aria-hidden /> Cancel</Button>
          <Button type="submit" variant="default" loading={loading} loadingLabel="Saving" disabled={name.trim() === user.name}>
            <Check size={13} strokeWidth={2} aria-hidden /> Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (open) {
      setCurrent(""); setNext(""); setConfirm(""); setNotice(null);
    }
  }, [open]);

  // Guard against losing unsaved edits to a refresh/close mid-edit.
  const passwordDirty = open && (current !== "" || next !== "" || confirm !== "");
  useEffect(() => {
    if (!passwordDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [passwordDirty]);

  const passwordFieldType = showPasswords ? "text" : "password";

  async function changePassword(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setNotice(null);
    if (next !== confirm) {
      setNotice({ kind: "err", text: "New passwords do not match." });
      return;
    }
    if (!isValidPassword(next)) {
      setNotice({ kind: "err", text: `Use at least ${PASSWORD_MIN_LENGTH} characters.` });
      return;
    }
    if (current === next) {
      setNotice({ kind: "err", text: "The new password must be different." });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setNotice({ kind: "err", text: data.error ?? "Failed to change password." });
        return;
      }
      setNotice({ kind: "ok", text: "Password updated successfully." });
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(onClose, 1200);
    } catch {
      setNotice({ kind: "err", text: "Network error while changing password." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Change password" description={`Use at least ${PASSWORD_MIN_LENGTH} characters.`} className="sm:max-w-md">
      <form onSubmit={changePassword} className="space-y-4 px-5 py-4">
        <Field label="Current password" type={passwordFieldType} placeholder="Enter your current password" icon={<Lock size={13} strokeWidth={2} />} value={current} onChange={(v) => { setCurrent(v); setNotice(null); }} autoComplete="current-password" required />
        <div>
          <Field label="New password" type={passwordFieldType} placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} icon={<KeyRound size={13} strokeWidth={2} />} value={next} onChange={(v) => { setNext(v); setNotice(null); }} autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={128} />
          <PasswordStrength password={next} className="mt-1.5" />
        </div>
        <Field label="Confirm new password" type={passwordFieldType} placeholder="Repeat your new password" icon={<KeyRound size={13} strokeWidth={2} />} value={confirm} onChange={(v) => { setConfirm(v); setNotice(null); }} autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={128} />
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={showPasswords} onCheckedChange={setShowPasswords} aria-label="Show passwords" />
          Show passwords
        </label>
        {notice && <Alert tone={notice.kind}>{notice.text}</Alert>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}><X size={13} strokeWidth={2} aria-hidden /> Cancel</Button>
          <Button type="submit" variant="default" loading={loading} loadingLabel="Updating">
            <KeyRound size={13} strokeWidth={2} aria-hidden /> Update password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({
  label,
  type,
  placeholder,
  icon,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  maxLength,
}: {
  label: string;
  type: string;
  placeholder?: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        startIcon={icon}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
      />
    </div>
  );
}
