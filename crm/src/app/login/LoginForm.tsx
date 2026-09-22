"use client";

import { useCrmBranding } from "@/components/BrandingProvider";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { Field, FormError, IconInput } from "@/components/form";

/**
 * Staff sign-in — enterprise split layout: brand panel on the left,
 * form on the right. Clean, focused, no distraction. Neutral palette —
 * the brand panel is a quiet muted surface with a border, no gradient.
 */
export function LoginForm() {
  const branding = useCrmBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn("credentials", { redirect: false, email, password });
      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel (desktop only) — neutral */}
      <div className="hidden w-2/5 flex-col justify-center border-r border-border bg-muted px-12 text-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background text-lg font-bold">
            {branding.logo}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{branding.name}</h1>
            <p className="text-sm text-muted-foreground">Sales & relationship management</p>
          </div>
        </div>

        <div className="mt-12 space-y-6">
          {[
            { title: "Pipeline visibility", desc: "Track every deal from first contact to close." },
            { title: "Team collaboration", desc: "Assign, share, and follow up with your team." },
            { title: "Data you can trust", desc: "Deduplication, audit trails, and scoped access." },
          ].map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground">
                <Icon name="check" size={12} strokeWidth={3} />
              </span>
              <div>
                <p className="text-base font-semibold">{feature.title}</p>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {branding.logo}
            </span>
            <div>
              <p className="text-lg font-bold text-foreground">{branding.name}</p>
              <p className="text-xs text-muted-foreground">Staff sign-in</p>
            </div>
          </div>

          <h2 className="mb-1 text-xl font-bold text-foreground lg:hidden">
            Sign in
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter your credentials to access the CRM.
          </p>

          <form method="post" onSubmit={handleSubmit} className="space-y-4">
            <FormError message={error} />

            <Field label="Email" required id="email">
              <IconInput
                id="email"
                name="email"
                icon="mail"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full"
                placeholder="you@company.com"
              />
            </Field>

            <Field label="Password" required id="password">
              <IconInput
                id="password"
                name="password"
                icon="shield"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full"
                placeholder="••••••••"
              />
            </Field>

            <Button
              variant="primary"
              size="lg"
              type="submit"
              icon="chevron_right"
              loading={submitting}
              className="mt-4 w-full"
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
