"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Pagination } from "@/components/ui/Pagination";

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
  const [actionDialog, setActionDialog] = useState<{ kind: "resolve" | "release"; id: string } | null>(null);
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

  if (loading) return <div className="text-sm text-text-muted">Loading reconciliation controls…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Reconciliation operations</h2>
          <p className="text-xs text-text-muted mt-1">Replay-safe ledger, projection, position and payment checks.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void refresh()} className="px-3 py-2 rounded border border-border text-xs hover:bg-panel-2">Refresh</button>
          {canManage && <button type="button" disabled={busy !== null} onClick={() => void runNow()} className="px-3 py-2 rounded bg-brand text-white text-xs disabled:opacity-50">
            {busy === "run" ? "Running…" : "Run now"}
          </button>}
        </div>
      </div>

      {error && <div role="alert" className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}

      <section>
        <h3 className="text-sm font-semibold mb-2">Active blocks [{blocks.length}]</h3>
        <div className="overflow-x-auto rounded border border-border bg-canvas">
          <table className="w-full text-xs">
            <thead className="bg-panel-2 text-text-muted"><tr><th className="text-left p-2">Account</th><th className="text-left p-2">Scope</th><th className="text-left p-2">Reason</th><th className="text-left p-2">Created</th><th className="p-2" /></tr></thead>
            <tbody>
              {visibleBlocks.map((block) => (
                <tr key={block.id} className="border-t border-border">
                  <td className="p-2">{block.user.email ?? block.userId}<div className="text-text-faint">#{block.user.accountNo ?? "—"}</div></td>
                  <td className="p-2 font-medium text-down">{block.scope}</td>
                  <td className="p-2 max-w-xl">{block.reason}</td>
                  <td className="p-2 whitespace-nowrap">{new Date(block.createdAt).toLocaleString()}</td>
                  <td className="p-2 text-right">{canManage ? <button type="button" disabled={busy !== null} onClick={() => { setActionNote(""); setActionDialog({ kind: "release", id: block.id }); }} className="px-2 py-1 rounded border border-border hover:bg-panel-2 disabled:opacity-50">Release</button> : <span className="text-text-faint">Read only</span>}</td>
                </tr>
              ))}
              {blocks.length === 0 && <tr><td colSpan={5} className="p-5 text-center text-text-muted">No active reconciliation blocks.</td></tr>}
            </tbody>
          </table>
          <Pagination page={safeBlockPage} pageSize={PAGE_SIZE} totalItems={blocks.length} onPageChange={setBlockPage} label="active blocks" compact />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Cases [{cases.length}]</h3>
        <div className="space-y-2">
          {visibleCases.map((item) => (
            <article key={item.id} className="rounded border border-border bg-canvas p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className={item.severity === "CRITICAL" ? "text-down font-semibold" : "text-text-muted"}>{item.severity}</span>
                    <span>{item.feedKind}</span><span>{item.status}</span><span>{new Date(item.detectedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm mt-1">{item.message}</p>
                  {(item.expectedValue || item.actualValue) && <p className="text-xs text-text-muted mt-1">Expected {item.expectedValue ?? "—"}; actual {item.actualValue ?? "—"}</p>}
                </div>
                {canManage && item.status !== "RESOLVED" && <div className="flex gap-2">
                  {item.status === "OPEN" && <button type="button" disabled={busy !== null} onClick={() => void commandCase(item.id, "ACKNOWLEDGE")} className="px-2 py-1 rounded border border-border text-xs">Acknowledge</button>}
                  <button type="button" disabled={busy !== null || item.blocks.length > 0} title={item.blocks.length > 0 ? "Release active blocks before resolving the case." : undefined} onClick={() => { setActionNote(""); setActionDialog({ kind: "resolve", id: item.id }); }} className="px-2 py-1 rounded bg-brand text-white text-xs disabled:opacity-40">Resolve</button>
                </div>}
              </div>
            </article>
          ))}
          {cases.length === 0 && <div className="rounded border border-border bg-canvas p-5 text-sm text-text-muted text-center">No reconciliation cases.</div>}
        </div>
        <div className="mt-2 overflow-hidden rounded border border-border">
          <Pagination page={safeCasePage} pageSize={PAGE_SIZE} totalItems={cases.length} onPageChange={setCasePage} label="reconciliation cases" compact />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Recent runs</h3>
        <div className="overflow-x-auto rounded border border-border bg-canvas">
          <table className="w-full text-xs">
            <thead className="bg-panel-2 text-text-muted"><tr><th className="text-left p-2">Started</th><th className="text-left p-2">Trigger</th><th className="text-left p-2">Status</th><th className="text-right p-2">Cases</th><th className="text-right p-2">Blocks</th><th className="text-left p-2">Reference</th></tr></thead>
            <tbody>
              {visibleRuns.map((run) => <tr key={run.id} className="border-t border-border"><td className="p-2 whitespace-nowrap">{new Date(run.startedAt).toLocaleString()}</td><td className="p-2">{run.trigger}</td><td className="p-2">{run.status}</td><td className="p-2 text-right">{run.caseCount}</td><td className="p-2 text-right">{run.blockCount}</td><td className="p-2 max-w-xs truncate" title={run.reference}>{run.reference}</td></tr>)}
              {runs.length === 0 && <tr><td colSpan={6} className="p-5 text-center text-text-muted">No reconciliation runs yet.</td></tr>}
            </tbody>
          </table>
          <Pagination page={safeRunPage} pageSize={PAGE_SIZE} totalItems={runs.length} onPageChange={setRunPage} label="reconciliation runs" compact />
        </div>
      </section>

      <Dialog
        open={actionDialog !== null}
        onClose={() => { if (!busy) { setActionDialog(null); setActionNote(""); } }}
        title={actionDialog?.kind === "release" ? "Release account block" : "Resolve reconciliation case"}
        description={actionDialog?.kind === "release"
          ? "Release only after the underlying discrepancy has been independently verified as resolved."
          : "The case can be resolved only after all linked active blocks have been released."}
        className="max-w-lg"
      >
        <form
          className="p-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!actionDialog) return;
            if (actionDialog.kind === "release") void release(actionDialog.id, actionNote);
            else void commandCase(actionDialog.id, "RESOLVE", actionNote);
          }}
        >
          <div>
            <label htmlFor="reconciliation-action-note" className="block text-xs font-medium mb-1">Reason</label>
            <textarea
              id="reconciliation-action-note"
              required
              minLength={3}
              maxLength={actionDialog?.kind === "release" ? 500 : 1000}
              rows={5}
              value={actionNote}
              onChange={(event) => setActionNote(event.target.value)}
              className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy !== null} onClick={() => { setActionDialog(null); setActionNote(""); }} className="px-3 py-2 rounded border border-border text-xs disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy !== null || actionNote.trim().length < 3} className="px-3 py-2 rounded bg-brand text-white text-xs disabled:opacity-50">
              {busy ? "Saving…" : actionDialog?.kind === "release" ? "Release block" : "Resolve case"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
