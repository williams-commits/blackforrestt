"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/trade/Logo";
import { Button } from "@/components/ui/Button";
import { browserDeviceIdentity } from "@/lib/device";
import { signInFailureMessage } from "@/lib/authClient";

const PASSWORD_REQUIREMENT = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/;

export default function RegisterPage() {
  const t = useTranslations("auth");
  const formId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendState, setResendState] = useState<{ loading: boolean; message: string | null }>({ loading: false, message: null });

  async function resendVerification() {
    setResendState({ loading: true, message: null });
    try {
      const response = await fetch("/api/security/email-verification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResendState({ loading: false, message: data?.error ?? t("resendFail") });
      } else if (data?.previewUrl) {
        setVerificationPreviewUrl(data.previewUrl);
        setResendState({ loading: false, message: t("devPreviewResend") });
      } else {
        setResendState({ loading: false, message: t("resendOk") });
      }
    } catch {
      setResendState({ loading: false, message: t("networkError") });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      setError(t("errName"));
      return;
    }
    if (!PASSWORD_REQUIREMENT.test(password)) {
      setError(t("errPwd"));
      return;
    }
    if (password !== confirm) {
      setError(t("errMatch"));
      return;
    }
    if (!agree) {
      setError(t("errAgree"));
      return;
    }

    setLoading(true);
    setShowResend(false);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName, email: normalizedEmail, password }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        needsVerification?: boolean;
        verificationDelivery?: "sent" | "preview" | "not_configured" | "failed";
        verificationPreviewUrl?: string;
        loginAllowed?: boolean;
        startingBalance?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? t("errRegister"));
        // Offer resend only when the existing account is registered but unverified.
        if (res.status === 409 && data?.needsVerification) setShowResend(true);
        return;
      }

      if (data?.loginAllowed) {
        const device = browserDeviceIdentity();
        const result = await signIn("credentials", {
          email: normalizedEmail,
          password,
          mfaCode: "",
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          redirect: false,
          redirectTo: "/account",
        });
        const signInError = signInFailureMessage(result);
        if (signInError) {
          setSuccess(t("okCreated"));
          setError(signInError);
          return;
        }
        window.location.assign("/account");
        return;
      }

      setVerificationPreviewUrl(data?.verificationPreviewUrl ?? null);
      setSuccess(
        data?.verificationDelivery === "sent"
          ? t("okSent")
          : data?.verificationDelivery === "preview"
            ? t("okPreview")
            : t("okNoMail"),
      );
    } catch {
      setError(t("errNetwork"));
    } finally {
      setLoading(false);
    }
  }

  const nameId = `${formId}-name`;
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const confirmId = `${formId}-confirm`;
  const termsId = `${formId}-terms`;
  const errorId = `${formId}-error`;

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center bg-panel px-4 py-10">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-6">
          <Logo className="text-lg" />
        </div>
        <div className="w-full bg-canvas border border-border rounded-lg shadow-panel p-8">
          <h1 className="text-lg font-semibold text-center mb-1">{t("createH1")}</h1>
          <p className="text-xs text-text-muted text-center mb-6">
            {t("createSub")}
          </p>

          {success ? (
            <div role="status" className="text-sm bg-up/10 border border-up/30 text-up rounded p-4">
              {success}
              {verificationPreviewUrl && (
                <a href={verificationPreviewUrl} className="block mt-3 text-brand hover:underline">
                  {t("verifyDev")}
                </a>
              )}
              <div className="mt-3 border-t border-up/20 pt-3">
                <p className="text-[11px] text-text-muted mb-2">{t("noEmail")}</p>
                <Button
                  type="button"
                  variant="brand"
                  loading={resendState.loading}
                  loadingLabel={t("resendSending")}
                  onClick={resendVerification}
                  className="w-full"
                >
                  {t("resendBtn")}
                </Button>
                {resendState.message && (
                  <p role="status" className="mt-2 text-[11px] text-text-muted">{resendState.message}</p>
                )}
              </div>
              <Link href="/login" className="block mt-3 text-brand hover:underline">
                {t("continueSignIn")}
              </Link>
            </div>
          ) : <form onSubmit={submit} className="w-full" aria-describedby={error ? errorId : undefined}>
            <div className="mb-4">
              <label htmlFor={nameId} className="block text-[11px] text-text-muted mb-1">
                {t("fullName")}
              </label>
              <input
                id={nameId}
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
              />
            </div>
            <div className="mb-4">
              <label htmlFor={emailId} className="block text-[11px] text-text-muted mb-1">
                {t("email")}
              </label>
              <input
                id={emailId}
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
              />
            </div>
            <div className="mb-4">
              <label htmlFor={passwordId} className="block text-[11px] text-text-muted mb-1">
                {t("password")}
              </label>
              <input
                id={passwordId}
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-describedby={`${passwordId}-hint`}
                className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
              />
              <p id={`${passwordId}-hint`} className="mt-1 text-[10px] text-text-faint">
                {t("pwdHint")}
              </p>
            </div>
            <div className="mb-4">
              <label htmlFor={confirmId} className="block text-[11px] text-text-muted mb-1">
                {t("confirmPassword")}
              </label>
              <input
                id={confirmId}
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
              />
            </div>

            <label htmlFor={termsId} className="flex items-start gap-2 mb-5 text-xs text-text-muted cursor-pointer">
              <input
                id={termsId}
                type="checkbox"
                required
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 accent-brand"
              />
              <span>
                {t.rich("agree", {
                  terms: (chunks) => <Link href="/legal/terms" target="_blank" className="text-brand hover:underline">{chunks}</Link>,
                  privacy: (chunks) => <Link href="/legal/privacy" target="_blank" className="text-brand hover:underline">{chunks}</Link>,
                })}
              </span>
            </label>

            {error && (
              <div
                id={errorId}
                role="alert"
                className="mb-3 text-xs text-down bg-down/10 border border-down/30 rounded px-3 py-2"
              >
                {error}
              </div>
            )}

            {showResend && (
              <div className="mb-3 rounded border border-brand/30 bg-brand-soft px-3 py-2 text-xs">
                <p className="text-text-muted mb-2">{t("resendUnverified")}</p>
                <Button
                  type="button"
                  variant="brand"
                  loading={resendState.loading}
                  loadingLabel={t("resendSending")}
                  onClick={resendVerification}
                  className="w-full"
                >
                  {t("resendBtn")}
                </Button>
                {resendState.message && (
                  <p role="status" className="mt-2 text-[11px] text-text-muted">{resendState.message}</p>
                )}
                {verificationPreviewUrl && (
                  <a href={verificationPreviewUrl} className="mt-2 block text-center text-brand hover:underline">
                    {t("devLink")}
                  </a>
                )}
              </div>
            )}

            <Button
              type="submit"
              variant="brand"
              loading={loading}
              loadingLabel={t("creating")}
              className="w-full"
            >
              {t("createBtn")}
            </Button>
          </form>}

          <p className="text-center text-xs text-text-muted mt-5">
            {t("haveAccount")}{" "}
            <Link href="/login" className="text-brand hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </div>
        <p className="text-[11px] text-text-faint mt-6 text-center max-w-xs">
          {t("riskNote")}
        </p>
      </div>
    </main>
  );
}
