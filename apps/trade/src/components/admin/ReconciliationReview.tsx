"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, Play, RefreshCw, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/Alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimpleDialog as Dialog } from "@/components/ui/Dialog";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";

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

const PAGE_SIZE = 10;

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
  const [blockPage, setBlockPage] = useState(1);
  const [casePage, setCasePage] = useState(1);
  const [runPage, setRunPage] = useState(1);

  const safeBlockPage = Math.min(blockPage, Math.max(1, Math.ceil(blocks.length / PAGE_SIZE)));
  const safeCasePage = Math.min(casePage, Math.max(1, Math.ceil(cases.length / PAGE_SIZE)));
  const safeRunPage = Math.min(runPage, Math.max(1, Math.ceil(runs.length / PAGE_SIZE)));
  const visibleBlocks = blocks.slice((safeBlockPage - 1) * PAGE_SIZE, safeBlockPage * PAGE_SIZE);
  const visibleCases = cases.slice((safeCasePage - 1) * PAGE_SIZE, safeCasePage * PAGE_SIZE);
  const visibleRuns = runs.slice((safeRunPage - 1) * PAGE_SIZE, safeRunPage * PAGE_SIZE);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Reconciliation operations</h2>
          <p className="text-xs text-muted-foreground mt-1">Replay-safe ledger, projection, position and payment checks.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()}><RefreshCw size={13} strokeWidth={2} aria-hidden /> Refresh</Button>
          {canManage && (
            <Button size="sm" loading={busy === "run"} loadingLabel="Running reconciliation" disabled={busy !== null} onClick={() => void runNow()}>
              <Play size={13} strokeWidth={2} aria-hidden /> Run now
            </Button>
          )}
          {canManage && (blocks.length > 0 || cases.length > 0) && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => { setActionNote(""); setBulkSummary(""); setActionDialog({ kind: "bulk" }); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-down/50 px-3 py-2 text-xs font-medium text-down hover:bg-down/10 disabled:opacity-50"
              title="Releases every active block and resolves every unresolved case across all users — not just this page."
            >
              <Unlock size={13} strokeWidth={2} aria-hidden /> {busy === "bulk" ? "Resolving all…" : "Release all & resolve all"}
            </button>
          )}
        </div>
      </div>

      {error && <Alert tone="err">{error}</Alert>}
      {bulkSummary && !error && <Alert tone="ok">{bulkSummary}</Alert>}

      <section>
        <h3 className="text-sm font-semibold mb-2">Active blocks [{blocks.length}]</h3>
        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
          <Table>
            <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Scope</TableHead><TableHead>Reason</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {visibleBlocks.map((block) => (
                <TableRow key={block.id}>
                  <TableCell>{block.user.email ?? block.userId}<div className="text-muted-foreground">#{block.user.accountNo ?? "—"}</div></TableCell>
                  <TableCell className="font-medium text-down">{block.scope}</TableCell>
                  <TableCell className="max-w-xl">{block.reason}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(block.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{canManage ? <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => { setActionNote(""); setActionDialog({ kind: "release", id: block.id }); }}><Unlock size={13} strokeWidth={2} aria-hidden /> Release</Button> : <span className="text-muted-foreground">Read only</span>}</TableCell>
                </TableRow>
              ))}
              {blocks.length === 0 && <TableRow><TableCell colSpan={5} className="p-5 text-center text-muted-foreground">No active reconciliation blocks.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <Pagination page={safeBlockPage} pageSize={PAGE_SIZE} totalItems={blocks.length} onPageChange={setBlockPage} label="active blocks" compact />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Cases [{cases.length}]</h3>
        <div className="space-y-2">
          {visibleCases.map((item) => (
            <article key={item.id} className="rounded-xl bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={item.severity === "CRITICAL" ? "text-down font-semibold" : "text-muted-foreground"}>{item.severity}</span>
                    <span>{item.feedKind}</span><span>{item.status}</span><span>{new Date(item.detectedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm mt-1">{item.message}</p>
                  {(item.expectedValue || item.actualValue) && <p className="text-xs text-muted-foreground mt-1">Expected {item.expectedValue ?? "—"}; actual {item.actualValue ?? "—"}</p>}
                </div>
                {canManage && item.status !== "RESOLVED" && <div className="flex gap-2">
                  {item.status === "OPEN" && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void commandCase(item.id, "ACKNOWLEDGE")}><Eye size={13} strokeWidth={2} aria-hidden /> Acknowledge</Button>}
                  <Button size="sm" disabled={busy !== null || item.blocks.length > 0} title={item.blocks.length > 0 ? "Release active blocks before resolving the case." : undefined} onClick={() => { setActionNote(""); setActionDialog({ kind: "resolve", id: item.id }); }}><CheckCircle2 size={13} strokeWidth={2} aria-hidden /> Resolve</Button>
                </div>}
              </div>
            </article>
          ))}
          {cases.length === 0 && <div className="rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground text-center">No reconciliation cases.</div>}
          <div className="mt-2">
            <Pagination page={safeCasePage} pageSize={PAGE_SIZE} totalItems={cases.length} onPageChange={setCasePage} label="reconciliation cases" compact />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Recent runs</h3>
        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
          <Table>
            <TableHeader><TableRow><TableHead>Started</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Cases</TableHead><TableHead className="text-right">Blocks</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleRuns.map((run) => <TableRow key={run.id}><TableCell className="whitespace-nowrap">{new Date(run.startedAt).toLocaleString()}</TableCell><TableCell>{run.trigger}</TableCell><TableCell>{run.status}</TableCell><TableCell className="text-right">{run.caseCount}</TableCell><TableCell className="text-right">{run.blockCount}</TableCell><TableCell className="max-w-xs truncate" title={run.reference}>{run.reference}</TableCell></TableRow>)}
              {runs.length === 0 && <TableRow><TableCell colSpan={6} className="p-5 text-center text-muted-foreground">No reconciliation runs yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <Pagination page={safeRunPage} pageSize={PAGE_SIZE} totalItems={runs.length} onPageChange={setRunPage} label="reconciliation runs" compact />
        </div>
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
