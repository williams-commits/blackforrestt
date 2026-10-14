"use client";

import { BadgeCheck, Building2, Check, Circle, FileText, Globe, Hash, MapPin, UserRound } from "lucide-react";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { KycDocuments } from "@/components/account/KycDocuments";
import { ADDRESS_DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPES } from "@/lib/kyc";
import { Input, DateInput } from "@/components/ui/Input";
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
    <div className="space-y-6">
      <StatusBanner status={status} kyc={kyc} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column — the current action: submit (or re-submit) for
            unverified accounts; the submitted identity summary otherwise. */}
        <div className="min-w-0 space-y-6">
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
                <Field label="First name" name="firstName" placeholder="e.g. Alex" icon={<UserRound size={13} strokeWidth={2} />} defaultValue={kyc?.firstName ?? ""} required maxLength={100} />
                <Field label="Last name" name="lastName" placeholder="e.g. Mercer" icon={<UserRound size={13} strokeWidth={2} />} defaultValue={kyc?.lastName ?? ""} required maxLength={100} />
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
                    <SelectTrigger id="country-field" className="h-10 w-full" startIcon={<Globe size={13} strokeWidth={2} aria-hidden />}>
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
              <Field label="Address" name="address" placeholder="Street and number" icon={<MapPin size={13} strokeWidth={2} />} required maxLength={200} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="City" name="city" placeholder="e.g. London" icon={<Building2 size={13} strokeWidth={2} />} required maxLength={100} />
                <Field label="Postal code" name="postalCode" placeholder="e.g. EC1A 1BB" icon={<Hash size={13} strokeWidth={2} />} maxLength={32} />
              </div>

                <div>
                  <Label htmlFor={docTypeId} className="text-xs font-medium text-muted-foreground">
                    Document type
                  </Label>
                  <Select name="docType" required defaultValue={kyc?.docType ?? "PASSPORT"}>
                    <SelectTrigger id={docTypeId} className="h-10 w-full" startIcon={<FileText size={13} strokeWidth={2} aria-hidden />}>
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
                <BadgeCheck size={13} strokeWidth={2} aria-hidden /> Submit for verification
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
                <dl className="space-y-2.5 text-sm">
                  <SummaryRow label="Name" value={[kyc.firstName, kyc.lastName].filter(Boolean).join(" ")} />
                  <SummaryRow label="Document type" value={kyc.docType ?? "—"} />
                  <SummaryRow label="Submitted" value={kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleString("en-US") : "—"} />
                </dl>
              </CardContent>
            </Card>
          )}

          {status === "APPROVED" && kyc && (
            <Card>
              <CardHeader>
                <CardTitle>Verified identity</CardTitle>
                <CardDescription>Your compliance record on file.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2.5 text-sm">
                  <SummaryRow label="Name" value={[kyc.firstName, kyc.lastName].filter(Boolean).join(" ")} />
                  <SummaryRow label="Document type" value={kyc.docType ?? "—"} />
                  <SummaryRow label="Submitted" value={kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleDateString("en-US") : "—"} />
                  <SummaryRow label="Approved" value={kyc.reviewedAt ? new Date(kyc.reviewedAt).toLocaleDateString("en-US") : "—"} />
                </dl>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Aside — verification progress; sticky on desktop so it stays
            visible while the (long) form or summary scrolls. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
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
        </aside>
      </div>

      <KycDocuments />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value || "—"}</dd>
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
  icon,
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
  icon?: React.ReactNode;
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
      {type === "date" ? (
      <DateInput
        id={id}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        maxLength={maxLength}
      />
      ) : (
      <Input
        id={id}
        type={type}
        name={name}
        placeholder={placeholder}
        startIcon={icon}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        maxLength={maxLength}
        className="h-10 placeholder:text-muted-foreground"
      />
      )}
    </div>
  );
}
