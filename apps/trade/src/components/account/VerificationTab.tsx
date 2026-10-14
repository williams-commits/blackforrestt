"use client";

import { Check, Circle } from "lucide-react";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { KycDocuments } from "@/components/account/KycDocuments";
import { ADDRESS_DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPES } from "@/lib/kyc";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

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
      <Card>
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle id="verification-checklist-heading">Verification checklist</CardTitle>
            <span className="text-xs font-semibold tnum text-muted-foreground">{progress}% complete</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Verification progress">
            <div className={`h-full rounded-full transition-all ${progress === 100 ? "bg-up" : "bg-brand"}`} style={{ width: `${progress}%` }} />
          </div>
          <ol className="mt-4 space-y-1.5">
            <ChecklistItem complete={status !== "NOT_SUBMITTED"} label="Identity and address details submitted" />
            <ChecklistItem complete={checklist.cleanIdentityDocuments > 0} label={`Identity document verified (${checklist.cleanIdentityDocuments})`} />
            <ChecklistItem complete={checklist.cleanAddressDocuments > 0} label={`Proof of address verified (${checklist.cleanAddressDocuments})`} />
            <ChecklistItem complete={noScanIssues} label={hasDocuments ? "No document scan issues outstanding" : "Upload documents for scanning"} />
            <ChecklistItem complete={status === "APPROVED"} label="Compliance review approved" />
          </ol>
        </CardContent>
      </Card>

      <KycDocuments />

      {status === "NOT_SUBMITTED" || status === "REJECTED" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {status === "REJECTED" ? "Re-submit verification" : "Verify your identity"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {status === "REJECTED" && kyc?.note ? (
                <Alert tone="err">Previous submission rejected: {kyc.note}</Alert>
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
                  <Label htmlFor="country-field" className="text-xs font-medium text-muted-foreground">Country</Label>
                  <Select name="country" defaultValue="">
                    <SelectTrigger id="country-field" className="h-10 w-full">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {KYC_COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Field label="Address" name="address" required maxLength={200} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="City" name="city" required maxLength={100} />
                <Field label="Postal code" name="postalCode" maxLength={32} />
              </div>

                <div>
                  <Label htmlFor={docTypeId} className="text-xs font-medium text-muted-foreground">
                    Document type
                  </Label>
                  <Select name="docType" required defaultValue={kyc?.docType ?? "PASSPORT"}>
                    <SelectTrigger id={docTypeId} className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Identity</SelectLabel>
                        {IDENTITY_DOCUMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Proof of address</SelectLabel>
                        {ADDRESS_DOCUMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">The selected type must show as Verified above before submission.</p>
                </div>

              {error ? (
                <Alert tone="err">{error}</Alert>
              ) : null}

              <Button
                type="submit"
                variant="default"
                loading={submitting}
                loadingLabel="Submitting verification"
              >
                Submit for verification
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {status === "PENDING" && kyc && (
        <Card>
          <CardHeader>
            <CardTitle>Submitted details</CardTitle>
            <CardDescription>Under compliance review — this is what we received.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              <SummaryRow label="Name" value={[kyc.firstName, kyc.lastName].filter(Boolean).join(" ")} />
              <SummaryRow label="Document type" value={kyc.docType ?? "—"} />
            </dl>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function ChecklistItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${complete ? "bg-(--term-success-bg)/40" : "bg-muted/40"}`}>
      <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full ${complete ? "bg-up/15 text-up" : "bg-muted text-muted-foreground"}`}>
        {complete ? <Check size={13} strokeWidth={2.5} /> : <Circle size={12} strokeWidth={2} />}
      </span>
      <span className={`text-sm ${complete ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`ml-auto text-xs font-medium ${complete ? "text-up" : "text-muted-foreground"}`}>{complete ? "Complete" : "Pending"}</span>
      <span className="sr-only">{complete ? "Complete" : "Incomplete"}</span>
    </li>
  );
}

function StatusBanner({ status, kyc }: { status: Kyc["status"]; kyc: Kyc | null }) {
  if (status === "APPROVED") {
    return (
      <Alert tone="ok">
        <strong className="font-medium">Identity verified</strong>
        <div className="text-xs text-muted-foreground">
          {kyc?.reviewedAt ? `Approved ${new Date(kyc.reviewedAt).toLocaleDateString("en-US")}. ` : ""}
          Your account is verified.
        </div>
      </Alert>
    );
  }
  if (status === "PENDING") {
    return (
      <Alert tone="info" className="border-primary/30 bg-primary/10">
        <strong className="font-medium text-primary">Verification under review</strong>
        <div className="text-xs text-muted-foreground">
          {kyc?.submittedAt ? `Submitted ${new Date(kyc.submittedAt).toLocaleDateString("en-US")}. ` : ""}
          You will be notified after review.
        </div>
      </Alert>
    );
  }
  if (status === "REJECTED") {
    return (
      <Alert tone="err">
        <strong className="font-medium">Verification rejected</strong>
        <div className="text-xs text-muted-foreground">Review the compliance note and submit corrected details.</div>
      </Alert>
    );
  }
  return (
    <Alert tone="info">
      <strong className="font-medium">Not verified</strong>
      <div className="text-xs text-muted-foreground">Complete identity verification before production withdrawals.</div>
    </Alert>
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
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        maxLength={maxLength}
        className="h-10 placeholder:text-muted-foreground"
      />
    </div>
  );
}
