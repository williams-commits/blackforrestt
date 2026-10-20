"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Eye, Lock, Play, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/Alert";
import { RecordList, RecordStatusChip } from "@/components/ui/RecordList";
import { IdentityTile } from "@/components/ui/Initial";
import { SimpleDialog as Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { SectionHeader } from "./SectionHeader";

interface RunRow {
  id: string;
  reference: string;
  trigger: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  caseCount: number;
  blockCount: number;
  errorMessage: string | null;
}

interface CaseRow {
  id: string;
  userId: string | null;
  feedKind: string;
  severity: string;
  status: string;
  message: string;
  expectedValue: string | null;
  actualValue: string | null;
  detectedAt: string;
  ownerAssignee: string | null;
  blocks: Array<{ id: string; scope: string }>;
}

interface BlockRow {
  id: string;
  userId: string;
  scope: string;
  reason: string;
  createdAt: string;
  user: { email: string | null; name: string | null; accountNo: string | null };
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed with status ${response.status}.`);
  return body as T;
}

export function ReconciliationReview({ canManage = false }: { canManage?: boolean }) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [bulkSummary, setBulkSummary] = useState("");
  const [actionDialog, setActionDialog] = useState<{ kind: "resolve" | "release" | "bulk"; id?: string } | null>(null);
  const [actionNote, setActionNote] = useState("");


  const refresh = useCallback(async () => {
    setError("");
    try {
      const [runData, caseData, blockData] = await Promise.all([
        jsonRequest<{ runs: RunRow[] }>("/api/admin/reconciliation/runs?limit=20"),
        jsonRequest<{ cases: CaseRow[] }>("/api/admin/reconciliation/cases?limit=50"),
        jsonRequest<{ blocks: BlockRow[] }>("/api/admin/reconciliation/blocks?active=true&limit=50"),
      ]);
      setRuns(runData.runs);
      setCases(caseData.cases);
      setBlocks(blockData.blocks);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load reconciliation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runNow() {
    setBusy("run");
    setError("");
    try {
      await jsonRequest("/api/admin/reconciliation/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to run reconciliation.");
    } finally {
      setBusy(null);
    }
  }

  async function commandCase(id: string, action: "ACKNOWLEDGE" | "RESOLVE", note?: string) {
    const normalizedNote = note?.trim();
    if (action === "RESOLVE" && (!normalizedNote || normalizedNote.length < 3)) return;
    setBusy(`case:${id}`);
    setError("");
    try {
      await jsonRequest(`/api/admin/reconciliation/cases/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "RESOLVE" ? { action, note: normalizedNote } : { action }),
      });
      setActionDialog(null);
      setActionNote("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update case.");
    } finally {
      setBusy(null);
    }
  }

  async function release(id: string, note: string) {
    const normalizedNote = note.trim();
    if (normalizedNote.length < 3) return;
    setBusy(`block:${id}`);
    setError("");
    try {
      await jsonRequest(`/api/admin/reconciliation/blocks/${id}/release`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: normalizedNote }),
      });
      setActionDialog(null);
      setActionNote("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to release block.");
    } finally {
      setBusy(null);
    }
  }

  async function bulkResolve(note: string) {
    const normalizedNote = note.trim();
    if (normalizedNote.length < 3) return;
    setBusy("bulk");
    setError("");
    try {
      const result = await jsonRequest<{ releasedBlocks: number; resolvedCases: number }>("/api/admin/reconciliation/bulk-resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: normalizedNote }),
      });
      setActionDialog(null);
      setActionNote("");
      await refresh();
      setBulkSummary(`Released ${result.releasedBlocks} block(s) and resolved ${result.resolvedCases} case(s).`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to bulk-resolve reconciliation items.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading reconciliation">
        <div className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3 w-80" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reconciliation operations"
        description="Replay-safe ledger, projection, position and payment checks."
        onRefresh={() => void refresh()}
        action={<>
          {canManage && (
            <Button size="sm" loading={busy === "run"} loadingLabel="Running reconciliation" disabled={busy !== null} onClick={() => void runNow()}>
              <Play size={13} strokeWidth={2} aria-hidden /> Run now
            </Button>
          )}
          {canManage && (blocks.length > 0 || cases.length > 0) && (
            <Button
              size="sm"
              variant="outline"
              className="text-down"
              disabled={busy !== null}
              onClick={() => { setActionNote(""); setBulkSummary(""); setActionDialog({ kind: "bulk" }); }}
              title="Releases every active block and resolves every unresolved case across all users — not just this page."
            >
              <Unlock size={13} strokeWidth={2} aria-hidden /> {busy === "bulk" ? "Resolving all…" : "Release all & resolve all"}
            </Button>
          )}
        </>}
      />

      {error && <Alert tone="err">{error}</Alert>}
      {bulkSummary && !error && <Alert tone="ok">{bulkSummary}</Alert>}

      <section>
        <RecordList<BlockRow>
          ariaLabel="Block"
          title="Active blocks"
          description={`${blocks.length} active`}
          rows={blocks}
          rowKey={(b) => b.id}
          leading={(b) => ({
            icon: <Lock size={15} strokeWidth={2} aria-hidden />,
            tone: "down",
            title: b.user.email ?? b.userId,
            secondary: `#${b.user.accountNo ?? "—"} · ${b.scope}`,
          })}
          columns={[
            { key: "reason", label: "Reason", render: (b) => <span className="text-xs text-muted-foreground">{b.reason}</span> },
            { key: "createdAt", label: "Created", sortable: true, align: "right", render: (b) => (
              <span className="text-xs text-muted-foreground tabular-nums">{new Date(b.createdAt).toLocaleString()}</span>
            ) },
          ]}
          sortValue={(b, key) => key === "createdAt" ? new Date(b.createdAt).getTime() : String((b as unknown as Record<string, unknown>)[key] ?? "")}
          initialSort={{ key: "createdAt", direction: "desc" }}
          detailTitle="Block Detail"
          renderDetailHero={(b) => (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
              <IdentityTile size="lg" tone="down"><Lock size={20} strokeWidth={2} aria-hidden /></IdentityTile>
              <div className="text-sm font-medium">{b.user.email ?? b.userId}</div>
              <div className="text-xs text-muted-foreground">#{b.user.accountNo ?? "—"} · {b.scope} blocked</div>
            </div>
          )}
          renderDetailMeta={(b) => [
            { label: "Scope", value: b.scope },
            { label: "Reason", value: b.reason },
            { label: "Created", value: new Date(b.createdAt).toLocaleString() },
          ]}
          renderDetailExtra={(b) => (
            canManage ? <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => { setActionNote(""); setActionDialog({ kind: "release", id: b.id }); }}><Unlock size={13} strokeWidth={2} aria-hidden /> Release block</Button> : undefined
          )}
          emptyTitle="No active reconciliation blocks."
        />
      </section>

      <section>
        <RecordList<CaseRow>
          ariaLabel="Case"
          title="Cases"
          description={`${cases.length} cases`}
          rows={cases}
          rowKey={(c) => c.id}
          leading={(c) => ({
            icon: <CircleAlert size={15} strokeWidth={2} aria-hidden />,
            tone: c.severity === "CRITICAL" ? "down" : "warn",
            title: c.message.slice(0, 60),
            secondary: `${c.severity} · ${c.feedKind} · ${new Date(c.detectedAt).toLocaleString()}`,
          })}
          columns={[
            { key: "status", label: "Status", render: (c) => (
              <RecordStatusChip tone={c.status === "RESOLVED" ? "up" : c.status === "ACKNOWLEDGED" ? "brand" : "warn"}>{c.status}</RecordStatusChip>
            ) },
            { key: "detectedAt", label: "Detected", sortable: true, align: "right", render: (c) => (
              <span className="text-xs text-muted-foreground tabular-nums">{new Date(c.detectedAt).toLocaleString()}</span>
            ) },
          ]}
          sortValue={(c, key) => key === "detectedAt" ? new Date(c.detectedAt).getTime() : String((c as unknown as Record<string, unknown>)[key] ?? "")}
          initialSort={{ key: "detectedAt", direction: "desc" }}
          detailTitle="Case Detail"
          renderDetailHero={(c) => (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
              <IdentityTile size="lg" tone={c.severity === "CRITICAL" ? "down" : "warn"}><CircleAlert size={20} strokeWidth={2} aria-hidden /></IdentityTile>
              <div className="text-sm font-medium">{c.feedKind}</div>
              <RecordStatusChip tone={c.status === "RESOLVED" ? "up" : "warn"}>{c.status}</RecordStatusChip>
            </div>
          )}
          renderDetailMeta={(c) => [
            { label: "Severity", value: c.severity },
            { label: "Feed", value: c.feedKind },
            { label: "Detected", value: new Date(c.detectedAt).toLocaleString() },
            ...(c.expectedValue || c.actualValue ? [{ label: "Expected / actual", value: `${c.expectedValue ?? "—"} / ${c.actualValue ?? "—"}` }] : []),
          ]}
          renderDetailExtra={(c) => (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/40 p-4">
                <div className="text-xs font-medium text-muted-foreground">Message</div>
                <p className="mt-1.5 text-sm leading-relaxed">{c.message}</p>
              </div>
              {canManage && c.status !== "RESOLVED" && (
                <div className="flex gap-2">
                  {c.status === "OPEN" && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void commandCase(c.id, "ACKNOWLEDGE")}><Eye size={13} strokeWidth={2} aria-hidden /> Acknowledge</Button>}
                  <Button size="sm" disabled={busy !== null || c.blocks.length > 0} title={c.blocks.length > 0 ? "Release active blocks before resolving the case." : undefined} onClick={() => { setActionNote(""); setActionDialog({ kind: "resolve", id: c.id }); }}><CheckCircle2 size={13} strokeWidth={2} aria-hidden /> Resolve</Button>
                </div>
              )}
            </div>
          )}
          emptyTitle="No reconciliation cases."
        />
      </section>

      <section>
        <RecordList<RunRow>
          ariaLabel="Run"
          title="Recent runs"
          description={`${runs.length} runs`}
          rows={runs}
          rowKey={(r) => r.id}
          leading={(r) => ({
            icon: r.status === "COMPLETED" ? <CheckCircle2 size={15} strokeWidth={2} aria-hidden /> : r.status === "FAILED" ? <CircleAlert size={15} strokeWidth={2} aria-hidden /> : <Play size={15} strokeWidth={2} aria-hidden />,
            tone: r.status === "COMPLETED" ? "up" : r.status === "FAILED" ? "down" : "warn",
            title: `Run ${r.reference.slice(0, 12)}…`,
            secondary: `${r.trigger} · ${r.caseCount} cases · ${r.blockCount} blocks`,
          })}
          columns={[
            { key: "status", label: "Status", render: (r) => (
              <RecordStatusChip tone={r.status === "COMPLETED" ? "up" : r.status === "FAILED" ? "down" : "warn"}>{r.status}</RecordStatusChip>
            ) },
            { key: "startedAt", label: "Started", sortable: true, align: "right", render: (r) => (
              <span className="text-xs text-muted-foreground tabular-nums">{new Date(r.startedAt).toLocaleString()}</span>
            ) },
          ]}
          sortValue={(r, key) => key === "startedAt" ? new Date(r.startedAt).getTime() : String((r as unknown as Record<string, unknown>)[key] ?? "")}
          initialSort={{ key: "startedAt", direction: "desc" }}
          detailTitle="Run Detail"
          renderDetailHero={(r) => (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
              <IdentityTile size="lg" tone={r.status === "COMPLETED" ? "up" : r.status === "FAILED" ? "down" : "warn"}>
                {r.status === "COMPLETED" ? <CheckCircle2 size={20} strokeWidth={2} aria-hidden /> : <Play size={20} strokeWidth={2} aria-hidden />}
              </IdentityTile>
              <div className="text-sm font-medium">{r.trigger} run</div>
              <RecordStatusChip tone={r.status === "COMPLETED" ? "up" : r.status === "FAILED" ? "down" : "warn"}>{r.status}</RecordStatusChip>
            </div>
          )}
          renderDetailMeta={(r) => [
            { label: "Reference", value: <span className="font-mono text-xs">{r.reference}</span> },
            { label: "Trigger", value: r.trigger },
            { label: "Cases", value: String(r.caseCount) },
            { label: "Blocks", value: String(r.blockCount) },
            { label: "Started", value: new Date(r.startedAt).toLocaleString() },
          ]}
          emptyTitle="No reconciliation runs yet."
        />
      </section>

      <Dialog
        open={actionDialog !== null}
        onClose={() => { if (!busy) { setActionDialog(null); setActionNote(""); } }}
        title={actionDialog?.kind === "release" ? "Release account block" : actionDialog?.kind === "bulk" ? "Release all & resolve all" : "Resolve reconciliation case"}
        description={actionDialog?.kind === "release"
          ? "Release only after the underlying discrepancy has been independently verified as resolved."
          : actionDialog?.kind === "bulk"
            ? "Releases every active reconciliation block and resolves every unresolved case for all users — including items beyond this page. This cannot be undone per-item; the reason is recorded in the audit trail."
            : "The case can be resolved only after all linked active blocks have been released."}
        className="max-w-lg"
      >
        <form
          className="p-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!actionDialog) return;
            if (actionDialog.kind === "release") void release(actionDialog.id!, actionNote);
            else if (actionDialog.kind === "bulk") void bulkResolve(actionNote);
            else void commandCase(actionDialog.id!, "RESOLVE", actionNote);
          }}
        >
          <div>
            <Label htmlFor="reconciliation-action-note" className="mb-1 block text-xs font-medium text-muted-foreground">Reason</Label>
            <Textarea
              id="reconciliation-action-note"
              required
              minLength={3}
              maxLength={actionDialog?.kind === "release" ? 500 : 1000}
              rows={5}
              value={actionNote}
              onChange={(event) => setActionNote(event.target.value)}
              placeholder="Describe the verified resolution…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => { setActionDialog(null); setActionNote(""); }}><X size={13} strokeWidth={2} aria-hidden /> Cancel</Button>
            <Button type="submit" size="sm" variant={actionDialog?.kind === "bulk" ? "destructive" : "default"} disabled={busy !== null || actionNote.trim().length < 3} loading={busy !== null}>
              {busy ? "Saving…" : actionDialog?.kind === "release" ? <><Unlock size={13} strokeWidth={2} aria-hidden /> Release block</> : actionDialog?.kind === "bulk" ? <><Unlock size={13} strokeWidth={2} aria-hidden /> Release all & resolve all</> : <><CheckCircle2 size={13} strokeWidth={2} aria-hidden /> Resolve case</>}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
