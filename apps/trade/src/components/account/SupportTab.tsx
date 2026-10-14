"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { LifeBuoy, Send, Tag } from "lucide-react";
import { IdentityTile } from "@/components/ui/Initial";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordList, RecordStatusChip, type RecordDetailMeta } from "@/components/ui/RecordList";
import { Label } from "@/components/ui/label";

const CATEGORIES = ["General enquiry", "Account & verification", "Deposits & withdrawals", "Technical issue", "Partnership"] as const;

interface SupportCase {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  description: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

const STATUS_TONES: Record<SupportCase["status"], "up" | "down" | "warn" | "brand" | "muted"> = {
  OPEN: "warn",
  IN_PROGRESS: "brand",
  WAITING_CUSTOMER: "up",
  RESOLVED: "up",
  CLOSED: "muted",
};

const STATUS_LABELS: Record<SupportCase["status"], string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_CUSTOMER: "Awaiting your reply",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Support on the enterprise RecordList — new-case Card on top, cases list
 *  with a side-slide detail (description, resolution, status) below. */
export function SupportTab() {

  // New case form state
  const [subject, setSubject] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState("");
  // Submit failures are action errors, distinct from the query error.
  const [actionError, setActionError] = useState("");

  const queryClient = useQueryClient();

  // Server state via react-query: 30s auto-sync (pauses in background tabs);
  // the shell's badge watcher invalidates when a case changes status.
  const { data, isPending, error: queryError } = useQuery({
    queryKey: ["account-support-cases"],
    queryFn: async () => {
      const res = await fetch("/api/support/cases", { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't load your support cases. Please refresh.");
      const payload = await res.json() as { cases?: SupportCase[] };
      return payload.cases ?? [];
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const cases = data ?? [];
  const loading = isPending;
  const loadCases = useCallback(
    async () => void queryClient.invalidateQueries({ queryKey: ["account-support-cases"] }),
    [queryClient],
  );

  useEffect(() => {
    const onCountsChanged = () => void queryClient.invalidateQueries({ queryKey: ["account-support-cases"] });
    window.addEventListener("blckforest:counts-changed", onCountsChanged);
    return () => window.removeEventListener("blckforest:counts-changed", onCountsChanged);
  }, [queryClient]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError("");
    setSuccessRef("");
    try {
      const res = await fetch("/api/support/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || "Couldn't submit your case. Please try again.");
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      setActionError("");
      setSuccessRef(data.reference);
      setMessage("");
      await loadCases();
    } catch {
      setActionError("Network error. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-8">
      {/* Create new case */}
      <Card>
        <CardHeader>
          <CardTitle>Open a support case</CardTitle>
          <CardDescription>Our team typically responds within one business day. Your case reference will appear below once submitted.</CardDescription>
        </CardHeader>
        <CardContent>
          {successRef && (
            <Alert tone="ok" className="mb-4">
              Case created — your reference is <strong>{successRef}</strong>. We&apos;ll reply by email.
            </Alert>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger aria-label="Subject" className="h-10 w-full" startIcon={<Tag size={13} strokeWidth={2} aria-hidden />}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Message</Label>
              <Textarea
                required
                minLength={10}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none"
                placeholder="Describe your issue or question…"
                aria-label="Message"
              />
            </div>
            {(queryError instanceof Error ? queryError.message : actionError) && <Alert tone="err">{queryError instanceof Error ? queryError.message : actionError}</Alert>}
            <Button
              type="submit"
              variant="default"
              loading={submitting}
              loadingLabel="Submitting…"
              disabled={message.trim().length < 10}
            >
              <Send size={13} strokeWidth={2} aria-hidden /> Submit case
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Case history */}
      <RecordList<SupportCase>
        ariaLabel="Case"
        title="Your support cases"
        description={`${cases.length} cases`}
        rows={cases}
        rowKey={(c) => c.id}
        loading={loading}
        search={{
          placeholder: "Search subject or reference…",
          text: (c) => `${c.subject} ${c.reference} ${c.category}`,
        }}
        leading={(c) => ({
          icon: <LifeBuoy size={15} strokeWidth={2} aria-hidden />,
          tone: c.status === "RESOLVED" || c.status === "CLOSED" ? "muted" : c.status === "WAITING_CUSTOMER" ? "up" : "brand",
          title: c.subject,
          secondary: <span className="font-mono text-xs">{c.reference}</span>,
        })}
        columns={[
          { key: "category", label: "Category", render: (c) => <span className="text-muted-foreground">{c.category}</span> },
          { key: "status", label: "Status", render: (c) => (
            <RecordStatusChip tone={STATUS_TONES[c.status]}>{STATUS_LABELS[c.status]}</RecordStatusChip>
          ) },
          { key: "createdAt", label: "Opened", sortable: true, align: "right", render: (c) => (
            <span className="text-xs text-muted-foreground tabular-nums">{new Date(c.createdAt).toLocaleDateString()}</span>
          ) },
        ]}
        sortValue={(c, key) => {
          switch (key) {
            case "createdAt": return new Date(c.createdAt).getTime();
            default: return String((c as unknown as Record<string, unknown>)[key] ?? "");
          }
        }}
        initialSort={{ key: "createdAt", direction: "desc" }}
        detailTitle="Case Detail"
        renderDetailHero={(c) => (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
            <IdentityTile size="lg"><LifeBuoy size={20} strokeWidth={2} aria-hidden /></IdentityTile>
            <div className="text-sm font-medium">{c.subject}</div>
            <RecordStatusChip tone={STATUS_TONES[c.status]}>{STATUS_LABELS[c.status]}</RecordStatusChip>
          </div>
        )}
        renderDetailMeta={(c): RecordDetailMeta[] => [
          { label: "Reference", value: <span className="font-mono text-xs">{c.reference}</span> },
          { label: "Category", value: c.category },
          { label: "Priority", value: c.priority },
          { label: "Opened", value: new Date(c.createdAt).toLocaleString() },
          ...(c.resolvedAt ? [{ label: "Resolved", value: new Date(c.resolvedAt).toLocaleString() }] : []),
        ]}
        renderDetailExtra={(c) => (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs font-medium text-muted-foreground">Description</div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{c.description}</p>
            </div>
            {c.resolutionNote && (
              <Alert tone="ok">
                <strong>Resolved:</strong> {c.resolutionNote}
              </Alert>
            )}
            {c.status === "WAITING_CUSTOMER" && (
              <p className="text-xs font-medium text-up">Awaiting your response — reply via chat or update this case.</p>
            )}
          </div>
        )}
        emptyTitle="No support cases yet"
        emptyHint="Open a case above and our team will respond."
      />
    </div>
  );
}
