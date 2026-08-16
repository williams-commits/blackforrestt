"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { KycDocuments } from "@/components/account/KycDocuments";
import { ADDRESS_DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPES } from "@/lib/kyc";

interface Kyc {
  status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
  firstName: string | null;
  lastName: string | null;
  docType: string | null;
  note: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

interface Props {
  kyc: Kyc | null;
  checklist: {
    cleanDocuments: number;
    cleanIdentityDocuments: number;
    cleanAddressDocuments: number;
    pendingDocuments: number;
    blockedDocuments: number;
  };
  onSubmitted: () => void;
}

function dateYearsAgo(years: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

/** Curated country list for KYC — keeps compliance data clean vs free text. */
const KYC_COUNTRIES = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile", "China", "Colombia",
  "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hong Kong",
  "Hungary", "Iceland", "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Kenya",
  "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malaysia", "Malta", "Mexico", "Monaco",
  "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Saudi Arabia", "Singapore", "Slovakia", "Slovenia", "South Africa",
  "South Korea", "Spain", "Sweden", "Switzerland", "Thailand", "Turkey", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam",
].sort();

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Submission failed with status ${response.status}.`;
  } catch {
    return `Submission failed with status ${response.status}.`;
  }
}

/** KYC submission form and compliance review status. */
export function VerificationTab({ kyc, checklist, onSubmitted }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = kyc?.status ?? "NOT_SUBMITTED";
  const docTypeId = useId();

  // "No scan issues" only counts as progress once documents actually exist —
  // an empty account has zero pending/blocked, which must not read as 20% done.
  const hasDocuments =
    checklist.cleanDocuments > 0 || checklist.pendingDocuments > 0 || checklist.blockedDocuments > 0;
  const noScanIssues = hasDocuments && checklist.pendingDocuments === 0 && checklist.blockedDocuments === 0;

  const steps = [
    status !== "NOT_SUBMITTED",
    checklist.cleanIdentityDocuments > 0,
    checklist.cleanAddressDocuments > 0,
    noScanIssues,
    status === "APPROVED",
  ];
  const progress = Math.round((steps.filter(Boolean).length / steps.length) * 100);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      router.refresh();
      onSubmitted();
    } catch {
      setError("Network error while submitting verification.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <StatusBanner status={status} kyc={kyc} />
      <section aria-labelledby="verification-checklist-heading" className="rounded-lg border border-border bg-canvas p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="verification-checklist-heading" className="text-sm font-medium">Verification checklist</h3>
          <span className="text-[10px] font-semibold tnum text-text-muted">{progress}% complete</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Verification progress">
          <div className={`h-full rounded-full transition-all ${progress === 100 ? "bg-up" : "bg-brand"}`} style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-3 space-y-2 text-xs">
          <ChecklistItem complete={status !== "NOT_SUBMITTED"} label="Identity and address details submitted" />
          <ChecklistItem complete={checklist.cleanIdentityDocuments > 0} label={`Identity document verified (${checklist.cleanIdentityDocuments})`} />
          <ChecklistItem complete={checklist.cleanAddressDocuments > 0} label={`Proof of address verified (${checklist.cleanAddressDocuments})`} />
          <ChecklistItem complete={noScanIssues} label={hasDocuments ? "No document scan issues outstanding" : "Upload documents for scanning"} />
          <ChecklistItem complete={status === "APPROVED"} label="Compliance review approved" />
        </ol>
      </section>

      <KycDocuments />

      {status === "NOT_SUBMITTED" || status === "REJECTED" ? (
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-canvas p-6">
          <h3 className="text-sm font-medium">
            {status === "REJECTED" ? "Re-submit verification" : "Verify your identity"}
          </h3>
          {status === "REJECTED" && kyc?.note ? (
            <div role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">
              Previous submission rejected: {kyc.note}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="First name" name="firstName" defaultValue={kyc?.firstName ?? ""} required maxLength={100} />
            <Field label="Last name" name="lastName" defaultValue={kyc?.lastName ?? ""} required maxLength={100} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Date of birth"
              name="dob"
              type="date"
              required
              min={dateYearsAgo(120)}
              max={dateYearsAgo(18)}
            />
            <div>
              <label htmlFor="country-field" className="mb-1 block text-[11px] text-text-muted">Country</label>
              <select
                id="country-field"
                name="country"
                required
                defaultValue=""
                className="h-10 w-full rounded border border-border bg-canvas px-2 text-sm outline-none focus:border-brand focus-visible:ring-1 focus-visible:ring-brand"
              >
                <option value="" disabled>Select country</option>
                {KYC_COUNTRIES.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          </div>
          <Field label="Address" name="address" required maxLength={200} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="City" name="city" required maxLength={100} />
            <Field label="Postal code" name="postalCode" maxLength={32} />
          </div>

          <div>
            <label htmlFor={docTypeId} className="mb-1 block text-[11px] text-text-muted">
              Document type
            </label>
            <select
              id={docTypeId}
              name="docType"
              required
              defaultValue={kyc?.docType ?? "PASSPORT"}
              className="h-10 w-full rounded border border-border bg-canvas px-2 text-sm outline-none focus:border-brand focus-visible:ring-1 focus-visible:ring-brand"
            >
              <optgroup label="Identity">
                {IDENTITY_DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </optgroup>
              <optgroup label="Proof of address">
                {ADDRESS_DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </optgroup>
            </select>
            <p className="mt-1 text-[10px] text-text-faint">The selected type must show as Verified above before submission.</p>
          </div>

          {error ? (
            <div role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            variant="brand"
            loading={submitting}
            loadingLabel="Submitting verification"
          >
            Submit for verification
          </Button>
        </form>
      ) : null}

      {status === "PENDING" && kyc && (
        <section aria-labelledby="pending-summary-heading" className="rounded-lg border border-border bg-canvas p-6">
          <h3 id="pending-summary-heading" className="text-sm font-medium">Submitted details</h3>
          <p className="mt-1 text-[11px] text-text-faint">Under compliance review — this is what we received.</p>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <SummaryRow label="Name" value={[kyc.firstName, kyc.lastName].filter(Boolean).join(" ")} />
            <SummaryRow label="Document type" value={kyc.docType ?? "—"} />
          </dl>
        </section>
      )}

    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border-soft py-1.5 last:border-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function ChecklistItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={complete ? "text-up" : "text-text-faint"}>{complete ? "✓" : "○"}</span>
      <span className={complete ? "text-text" : "text-text-muted"}>{label}</span>
      <span className="sr-only">{complete ? "Complete" : "Incomplete"}</span>
    </li>
  );
}

function StatusBanner({ status, kyc }: { status: Kyc["status"]; kyc: Kyc | null }) {
  if (status === "APPROVED") {
    return (
      <div role="status" className="flex items-center gap-3 rounded-lg border border-up/30 bg-up/10 p-4">
        <span aria-hidden="true" className="text-lg text-up">✓</span>
        <div>
          <div className="text-sm font-medium text-up">Identity verified</div>
          <div className="text-xs text-text-muted">
            {kyc?.reviewedAt ? `Approved ${new Date(kyc.reviewedAt).toLocaleDateString("en-US")}. ` : ""}
            Your account is verified.
          </div>
        </div>
      </div>
    );
  }
  if (status === "PENDING") {
    return (
      <div role="status" className="flex items-center gap-3 rounded-lg border border-brand/30 bg-brand-soft p-4">
        <span aria-hidden="true" className="text-lg text-brand">⏳</span>
        <div>
          <div className="text-sm font-medium text-brand">Verification under review</div>
          <div className="text-xs text-text-muted">
            {kyc?.submittedAt ? `Submitted ${new Date(kyc.submittedAt).toLocaleDateString("en-US")}. ` : ""}
            You will be notified after review.
          </div>
        </div>
      </div>
    );
  }
  if (status === "REJECTED") {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-lg border border-down/30 bg-down/10 p-4">
        <span aria-hidden="true" className="text-lg text-down">✕</span>
        <div>
          <div className="text-sm font-medium text-down">Verification rejected</div>
          <div className="text-xs text-text-muted">Review the compliance note and submit corrected details.</div>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-border bg-panel-2 p-4">
      <span aria-hidden="true" className="text-lg text-text-muted">⚠</span>
      <div>
        <div className="text-sm font-medium">Not verified</div>
        <div className="text-xs text-text-muted">Complete identity verification before production withdrawals.</div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
  min,
  max,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  min?: string;
  max?: string;
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
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        maxLength={maxLength}
        className="h-10 w-full rounded border border-border bg-canvas px-3 text-sm outline-none placeholder:text-text-faint focus:border-brand focus-visible:ring-1 focus-visible:ring-brand"
      />
    </div>
  );
}
