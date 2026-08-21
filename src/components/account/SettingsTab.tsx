"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { PASSWORD_MIN_LENGTH, isValidPassword } from "@/lib/passwordPolicy";
import { SecurityCenter } from "./SecurityCenter";
import { fmtDate } from "@/lib/dates";

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

/** Editable profile and password security settings. */
export function SettingsTab({ user }: { user: User }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);

  const profileDirty = name.trim() !== user.name;
  const passwordDirty = current !== "" || next !== "" || confirm !== "";

  // Guard against losing unsaved edits to a refresh/close mid-edit.
  useEffect(() => {
    if (!profileDirty && !passwordDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [profileDirty, passwordDirty]);

  const passwordFieldType = showPasswords ? "text" : "password";

  async function saveProfile(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setProfileNotice(null);
    const normalizedName = name.trim();
    if (!normalizedName) {
      setProfileNotice({ kind: "err", text: "Name cannot be empty." });
      return;
    }

    setProfileLoading(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setProfileNotice({ kind: "err", text: data.error ?? "Failed to update profile." });
        return;
      }
      setName(normalizedName);
      setProfileNotice({ kind: "ok", text: "Profile updated." });
      router.refresh();
    } catch {
      setProfileNotice({ kind: "err", text: "Network error while updating the profile." });
    } finally {
      setProfileLoading(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPasswordNotice(null);

    if (next !== confirm) {
      setPasswordNotice({ kind: "err", text: "New passwords do not match." });
      return;
    }
    if (!isValidPassword(next)) {
      setPasswordNotice({
        kind: "err",
        text: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
      });
      return;
    }
    if (current === next) {
      setPasswordNotice({ kind: "err", text: "The new password must be different." });
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setPasswordNotice({ kind: "err", text: data.error ?? "Failed to change password." });
        return;
      }
      setPasswordNotice({ kind: "ok", text: "Password updated successfully." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setPasswordNotice({ kind: "err", text: "Network error while changing the password." });
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <form onSubmit={saveProfile} className="space-y-4 rounded-lg border border-border bg-canvas p-6">
        <h3 className="text-sm font-medium">Profile</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Display name"
            type="text"
            value={name}
            onChange={(value) => {
              setName(value);
              setProfileNotice(null);
            }}
            autoComplete="name"
            maxLength={100}
          />
          <ReadonlyField label="Email" value={user.email} />
          <ReadonlyField label="Account number" value={user.accountNo} />
          <ReadonlyField
            label="Member since"
            value={fmtDate(user.createdAt)}
          />
          <ReadonlyField
            label="Verification"
            value={user.verified ? "Verified" : "Unverified"}
            valueClass={user.verified ? "text-up" : "text-down"}
          />
        </div>

        <NoticeView notice={profileNotice} />

        <Button
          type="submit"
          variant="brand"
          loading={profileLoading}
          loadingLabel="Saving profile"
          disabled={name.trim() === user.name}
          className="bg-brand text-white hover:brightness-110"
        >
          Save profile
        </Button>
      </form>

      <form onSubmit={changePassword} className="space-y-4 rounded-lg border border-border bg-canvas p-6">
        <div>
          <h3 className="text-sm font-medium">Change password</h3>
          <p className="mt-1 text-[11px] text-text-faint">
            Use at least 6 characters.
          </p>
        </div>
        <Field
          label="Current password"
          type={passwordFieldType}
          value={current}
          onChange={(value) => {
            setCurrent(value);
            setPasswordNotice(null);
          }}
          autoComplete="current-password"
          required
        />
        <div>
          <Field
            label="New password"
            type={passwordFieldType}
            value={next}
            onChange={(value) => {
              setNext(value);
              setPasswordNotice(null);
            }}
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={128}
          />
          <PasswordStrength password={next} className="mt-1.5" />
        </div>
        <Field
          label="Confirm new password"
          type={passwordFieldType}
          value={confirm}
          onChange={(value) => {
            setConfirm(value);
            setPasswordNotice(null);
          }}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={128}
        />
        <label className="flex w-fit cursor-pointer items-center gap-2 text-[11px] text-text-muted">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(event) => setShowPasswords(event.target.checked)}
            className="h-3.5 w-3.5 accent-brand"
          />
          Show passwords
        </label>

        <NoticeView notice={passwordNotice} />

        <Button
          type="submit"
          variant="brand"
          loading={passwordLoading}
          loadingLabel="Updating password"
          className="bg-brand text-white hover:brightness-110"
        >
          Update password
        </Button>
      </form>

      <SecurityCenter />
    </div>
  );
}

function NoticeView({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div
      role={notice.kind === "err" ? "alert" : "status"}
      className={`rounded border px-3 py-2 text-xs ${
        notice.kind === "ok"
          ? "border-up/30 bg-up/10 text-up"
          : "border-down/30 bg-down/10 text-down"
      }`}
    >
      {notice.text}
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  maxLength,
}: {
  label: string;
  type: string;
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
      <label htmlFor={id} className="mb-1 block text-[11px] text-text-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm outline-none focus:border-brand focus-visible:ring-1 focus-visible:ring-brand"
      />
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-text-muted">{label}</div>
      <div className="flex h-10 items-center rounded border border-border bg-panel-2 px-3 text-sm text-text-muted">
        <span className={valueClass}>{value}</span>
      </div>
    </div>
  );
}
