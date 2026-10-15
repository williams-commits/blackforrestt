"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsForm, type UserSettingsConfig } from "./SettingsForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/lib/toast";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { IdentityTile, initialsOf } from "@/components/ui/Initial";
import { RecordList, RecordStatusChip } from "@/components/ui/RecordList";
import { Check, Play, Plus, Save, Search, UserMinus, UserPlus, X } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Group {
  id: string;
  name: string;
  description: string | null;
  color: string;
  settings: Record<string, unknown>;
  memberCount: number;
  createdAt: string;
}

interface GroupMember {
  id: string;
  assignedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    accountNo: string | null;
    verified: boolean;
    balance: number;
    equity: number;
    floatingPl: number;
  };
}

interface GroupDetail extends Group {
  members: Array<{
    id: string;
    assignedAt: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      accountNo: string | null;
      verified: boolean;
      balance: number;
      equity: number;
      floatingPl: number;
    };
  }>;
}

/** Settings preset summaries for the group list view. */
function getSettingsSummary(settings: Record<string, unknown>): string[] {
  const tags: string[] = [];
  const t = settings.trading as Record<string, unknown> | undefined;
  const d = settings.deposits as Record<string, unknown> | undefined;
  const p = settings.pnl as Record<string, unknown> | undefined;
  if (t && t.enabled === false) tags.push("Trading off");
  if (t && Array.isArray(t.allowedCategories) && t.allowedCategories.length < 5) tags.push(`${t.allowedCategories.length} categories`);
  if (d && d.uiEnabled === false) tags.push("Deposits off");
  if (p && typeof p.spreadMarkupPips === "number" && p.spreadMarkupPips > 0) tags.push(`+${p.spreadMarkupPips}pip markup`);
  if (p && typeof p.pnlAdjustmentPercent === "number" && p.pnlAdjustmentPercent !== 0) tags.push(`${p.pnlAdjustmentPercent}% P/L`);
  return tags;
}

/** Groups management panel — list, create, view members, configure settings. */
export function GroupsPanel({ canManage }: { canManage: boolean }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/groups", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load groups");
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load groups.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (selected) {
    return <GroupDetailPanel groupId={selected} canManage={canManage} onBack={() => { setSelected(null); void refresh(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">User Groups</h2>
        {canManage && <CreateGroupButton onCreated={() => void refresh()} />}
      </div>

      {error && <Alert tone="err">{error}</Alert>}

      {loading ? (
        <div className="space-y-2.5" role="status" aria-label="Loading groups">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No groups yet. Create one to start managing users in bulk.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => {
            const isExpanded = expanded.has(g.id);
            const tags = getSettingsSummary(g.settings);
            const hasSettings = Object.keys(g.settings).length > 0;
            return (
              <div key={g.id} className="rounded-xl overflow-hidden">
                {/* Collapsible header row */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => toggleExpand(g.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className={`text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                    >
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: g.color }} />
                    <span className="font-semibold text-sm truncate">{g.name}</span>
                    {g.description && <span className="text-xs text-muted-foreground truncate hidden sm:inline">— {g.description}</span>}
                  </button>

                  {/* Quick stats */}
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    {tags.length > 0 && (
                      <div className="hidden md:flex items-center gap-1">
                        {tags.map((tag) => (
                          <span key={tag} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">{tag}</span>
                        ))}
                      </div>
                    )}
                    <span className="text-muted-foreground">{g.memberCount} member{g.memberCount === 1 ? "" : "s"}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {canManage && <EditGroupButton group={g} onSaved={() => void refresh()} />}
                    <button
                      onClick={() => setSelected(g.id)}
                      className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition"
                    >
                      Open →
                    </button>
                  </div>
                </div>

                {/* Expanded preview: collapsible settings detail + members */}
                {isExpanded && (
                  <div className="border-t border-border bg-panel/30 p-4 space-y-3">
                    {/* Collapsible settings detail */}
                    <CollapsibleSection title="Category Settings" defaultOpen={hasSettings}>
                      {hasSettings ? (
                        <div className="space-y-2">
                          {/* Trading */}
                          <SettingsCategory
                            label="Trading"
                            items={getCategoryItems(g.settings, "trading", [
                              { key: "enabled", label: "Trading", type: "bool" },
                              { key: "maxOrderLots", label: "Max lots", type: "value" },
                              { key: "marginWarningPercent", label: "Margin warning", type: "value", suffix: "%" },
                              { key: "allowedCategories", label: "Categories", type: "list" },
                            ])}
                          />
                          {/* Deposits */}
                          <SettingsCategory
                            label="Deposits"
                            items={getCategoryItems(g.settings, "deposits", [
                              { key: "uiEnabled", label: "Deposit UI", type: "bool" },
                              { key: "allowedMethods", label: "Methods", type: "list" },
                            ])}
                          />
                          {/* Withdrawals */}
                          <SettingsCategory
                            label="Withdrawals"
                            items={getCategoryItems(g.settings, "withdrawals", [
                              { key: "requireKyc", label: "KYC required", type: "bool" },
                              { key: "dailyLimit", label: "Daily limit", type: "value", prefix: "$" },
                              { key: "monthlyLimit", label: "Monthly limit", type: "value", prefix: "$" },
                            ])}
                          />
                          {/* P/L */}
                          <SettingsCategory
                            label="P/L Manipulation"
                            items={getCategoryItems(g.settings, "pnl", [
                              { key: "spreadMarkupPips", label: "Spread markup", type: "value", suffix: " pips" },
                              { key: "commissionPerLotOverride", label: "Commission/lot", type: "value", prefix: "$" },
                              { key: "pnlAdjustmentPercent", label: "P/L adjustment", type: "value", suffix: "%" },
                            ])}
                          />
                          {/* Balance */}
                          <SettingsCategory
                            label="Balance"
                            items={getCategoryItems(g.settings, "balance", [
                              { key: "demoStartingBalance", label: "Demo balance", type: "value", prefix: "$" },
                              { key: "maxCreditBonus", label: "Max bonus", type: "value", prefix: "$" },
                            ])}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Using global defaults — no overrides configured</span>
                      )}
                    </CollapsibleSection>

                    {/* Quick member preview */}
                    <CollapsibleSection title={`Members (${g.memberCount})`} defaultOpen={true}>
                      <GroupMemberPreview groupId={g.id} />
                    </CollapsibleSection>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Fetches and shows a compact member preview for the expanded card. */
function GroupMemberPreview({ groupId }: { groupId: string }) {
  const [members, setMembers] = useState<Array<{ user: { name: string | null; email: string | null; balance: number } }> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/groups/${groupId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setMembers(data.group?.members ?? []);
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-1.5" role="status" aria-label="Loading members">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-24 rounded-full" />)}
      </div>
    );
  }
  if (!members || members.length === 0) return <p className="text-xs text-muted-foreground">No members</p>;

  const totalBalance = members.reduce((s, m) => s + m.user.balance, 0);
  return (
    <div>
      <div className="flex items-center gap-3 mb-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</p>
        <span className="text-xs text-muted-foreground">Total balance: ${totalBalance.toFixed(2)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {members.slice(0, 8).map((m, i) => (
          <span key={i} className="rounded-full py-0.5 text-xs">
            {m.user.name ?? m.user.email ?? "Unknown"}
          </span>
        ))}
        {members.length > 8 && (
          <span className="rounded-full py-0.5 text-xs text-muted-foreground">
            +{members.length - 8} more
          </span>
        )}
      </div>
    </div>
  );
}

function EditGroupButton({ group, onSaved }: { group: Group; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [desc, setDesc] = useState(group.description ?? "");
  const [color, setColor] = useState(group.color);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc || null, color }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update group.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-accent/60 transition"
        aria-label="Edit group"
        title="Edit name, description, color"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-w-md rounded-xl p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4">Edit Group</h3>
            {err && <Alert tone="err" className="mb-3">{err}</Alert>}
            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                  className="h-10" />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Description</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional"
                  className="h-10" />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Color</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12" />
                  <span className="text-xs text-muted-foreground font-mono">{color}</span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}><X size={13} strokeWidth={2} aria-hidden /> Cancel</Button>
              <Button type="button" onClick={() => void submit()} disabled={saving || name.length < 2} loading={saving} loadingLabel="Saving">
                <Save size={13} strokeWidth={2} aria-hidden /> Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AddMemberButton({ groupId, onAdded, existingIds }: { groupId: string; onAdded: () => void; existingIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string | null; email: string | null; accountNo: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&limit=20`, { cache: "no-store" });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.users ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void search(query), 300);
    return () => clearTimeout(timer);
  }, [query, open, search]);

  const add = async (userId: string) => {
    setAdding(userId);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add");
      }
      setResults((prev) => prev.filter((u) => u.id !== userId));
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add member.");
    } finally {
      setAdding(null);
    }
  };

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <UserPlus size={13} strokeWidth={2} aria-hidden /> Add Member
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-w-md rounded-xl p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4">Add Member</h3>
            {err && <Alert tone="err" className="mb-3">{err}</Alert>}
            <div className="flex gap-2 mb-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, or account no…"
                className="flex-1"
                autoFocus
              />
              <Button type="button" size="sm" variant="outline" onClick={() => void search(query)}><Search size={13} strokeWidth={2} aria-hidden /> Search</Button>
            </div>

            <div className="max-h-64 overflow-y-auto border-border">
              {searching && <p className="p-3 text-xs text-muted-foreground">Searching…</p>}
              {!searching && results.length === 0 && query.length >= 2 && (
                <p className="p-3 text-xs text-muted-foreground">No users found.</p>
              )}
              {!searching && query.length < 2 && (
                <p className="p-3 text-xs text-muted-foreground">Type at least 2 characters to search.</p>
              )}
              {results.map((u) => {
                const already = existingIds.includes(u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between border-b border-border last:border-0">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{u.name ?? "Unknown"}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email} · {u.accountNo ?? "—"}</div>
                    </div>
                    <button
                      onClick={() => already ? undefined : void add(u.id)}
                      disabled={already || adding === u.id}
                      className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium transition ${
                        already ? "bg-muted text-muted-foreground cursor-default" : "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50"
                      }`}
                    >
                      {already ? "In group" : adding === u.id ? "Adding…" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}><Check size={13} strokeWidth={2} aria-hidden /> Done</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CreateGroupButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc || undefined, color }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create group");
      }
      setOpen(false);
      setName("");
      setDesc("");
      setColor("#6366f1");
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unable to create group.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={13} strokeWidth={2} aria-hidden /> New Group
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div className="max-w-md rounded-xl p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold mb-4">Create Group</h3>
        {err && <Alert tone="err" className="mb-3">{err}</Alert>}
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VIP Traders"
              className="h-10" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Description (optional)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description"
              className="h-10" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Color</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12" />
              <span className="text-xs text-muted-foreground font-mono">{color}</span>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}><X size={13} strokeWidth={2} aria-hidden /> Cancel</Button>
          <Button type="button" onClick={() => void submit()} disabled={saving || name.length < 2} loading={saving} loadingLabel="Creating">
            <Plus size={13} strokeWidth={2} aria-hidden /> Create
          </Button>
        </div>
      </div>
    </div>
  );
}

function GroupDetailPanel({ groupId, canManage, onBack }: { groupId: string; canManage: boolean; onBack: () => void }) {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ userId: string; label: string } | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load group");
      const data = await res.json();
      setDetail(data.group);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load group.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const confirmRemove = (userId: string, label: string) => setRemoving({ userId, label });

  const removeMember = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/members?userId=${removing.userId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error("Remove failed", body.error ?? "Failed to remove member.");
        return;
      }
      toast.success("Member removed", `${removing.label} no longer belongs to this group.`);
      setRemoving(null);
      void refresh();
    } catch {
      toast.error("Remove failed", "Network error — could not remove member.");
    } finally {
      setRemoveBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading group">
        <Skeleton className="h-3.5 w-28" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }
  if (error || !detail) return <div className="text-sm text-down">{error ?? "Group not found"}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-xs text-primary hover:underline">← Back to groups</button>
      </div>

      {/* Group header with inline edit */}
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 rounded-full" style={{ background: detail.color }} />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold">{detail.name}</h2>
          {detail.description && <p className="text-xs text-muted-foreground">{detail.description}</p>}
        </div>
        {canManage && <EditGroupButton group={detail} onSaved={() => void refresh()} />}
      </div>

      {/* Settings editor */}
      {canManage && (
        <SettingsEditor groupId={detail.id} initial={detail.settings as UserSettingsConfig} onSaved={() => void refresh()} />
      )}
      {!canManage && <SettingsPreview settings={detail.settings} />}

      {/* Bulk actions */}
      {canManage && detail.members.length > 0 && (
        <BulkActions groupId={detail.id} groupName={detail.name} memberCount={detail.members.length} />
      )}

      {/* Members */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Members ({detail.members.length})</h3>
          {canManage && <AddMemberButton groupId={detail.id} onAdded={() => void refresh()} existingIds={detail.members.map((m) => m.user.id)} />}
        </div>
        {detail.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <RecordList<GroupMember>
            ariaLabel="Member"
            title="Members"
            description={`${detail.members.length} members`}
            rows={detail.members}
            rowKey={(m) => m.id}
            search={{ placeholder: "Search name or email…", text: (m) => `${m.user.name ?? ""} ${m.user.email ?? ""} ${m.user.accountNo ?? ""}` }}
            leading={(m) => ({
              icon: null,
              tone: m.user.verified ? "muted" : "down",
              title: (
                <span className="flex items-center gap-2">
                  <IdentityTile tone={m.user.verified ? "muted" : "down"}>{initialsOf(m.user.name ?? m.user.email)}</IdentityTile>
                  {m.user.name ?? "—"}
                </span>
              ),
              secondary: `${m.user.email ?? "—"} · #${m.user.accountNo ?? "—"}`,
            })}
            columns={[
              { key: "balance", label: "Balance", sortable: true, align: "right", render: (m) => <span className="tabular-nums">{m.user.balance.toFixed(2)}</span> },
              { key: "equity", label: "Equity", sortable: true, align: "right", render: (m) => <span className="tabular-nums">{m.user.equity.toFixed(2)}</span> },
              { key: "floatingPl", label: "P/L", sortable: true, align: "right", render: (m) => (
                <span className={`font-semibold tabular-nums ${m.user.floatingPl >= 0 ? "text-up" : "text-down"}`}>
                  {m.user.floatingPl >= 0 ? "+" : ""}{m.user.floatingPl.toFixed(2)}
                </span>
              ) },
            ]}
            sortValue={(m, key) => {
              switch (key) {
                case "balance": return m.user.balance;
                case "equity": return m.user.equity;
                case "floatingPl": return m.user.floatingPl;
                default: return String((m as unknown as Record<string, unknown>)[key] ?? "");
              }
            }}
            initialSort={{ key: "equity", direction: "desc" }}
            detailTitle="Member Detail"
            renderDetailHero={(m) => (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
                <IdentityTile size="lg" tone={m.user.verified ? "muted" : "down"}>{initialsOf(m.user.name ?? m.user.email)}</IdentityTile>
                <div className="text-sm font-medium">{m.user.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{m.user.email ?? "—"}</div>
                {!m.user.verified && <RecordStatusChip tone="down">Unverified</RecordStatusChip>}
              </div>
            )}
            renderDetailMeta={(m) => [
              { label: "Account", value: m.user.accountNo ?? "—" },
              { label: "Balance", value: m.user.balance.toFixed(2) },
              { label: "Equity", value: m.user.equity.toFixed(2) },
              { label: "Floating P/L", value: m.user.floatingPl.toFixed(2) },
              { label: "Member since", value: new Date(m.assignedAt).toLocaleDateString() },
            ]}
            renderDetailExtra={(m) => (
              canManage ? (
                <Button type="button" size="sm" variant="outline" className="w-full text-down" onClick={() => confirmRemove(m.user.id, m.user.name ?? m.user.email ?? "this member")}>
                  <UserMinus size={13} strokeWidth={2} aria-hidden /> Remove from group
                </Button>
              ) : undefined
            )}
            emptyTitle="No members yet."
          />
        )}
      </div>

      <ConfirmDialog
        open={removing !== null}
        title="Remove member from group?"
        message={removing ? `Remove ${removing.label} from this group? They will fall back to global default settings.` : ""}
        confirmLabel="Remove member"
        busy={removeBusy}
        onConfirm={() => void removeMember()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

function BulkActions({ groupId, groupName, memberCount }: { groupId: string; groupName: string; memberCount: number }) {
  const [dialog, setDialog] = useState<"balance" | "pnl" | null>(null);

  return (
    <div className="rounded-xl bg-panel/50 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Bulk Actions ({memberCount} members)</h4>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDialog("balance")}
          className="px-4 font-semibold hover:bg-accent/60 transition"
        >
          Adjust All Balances
        </button>
        <button
          onClick={() => setDialog("pnl")}
          className="px-4 font-semibold hover:bg-accent/60 transition"
        >
          Set P/L for All Positions
        </button>
      </div>

      {dialog === "balance" && (
        <BulkDialog
          title={`Adjust balances — ${groupName}`}
          subtitle={`This will apply the same credit/debit to all ${memberCount} members.`}
          fields={[
            { key: "action", label: "Action", type: "select", options: ["CREDIT", "DEBIT"], default: "CREDIT" },
            { key: "amount", label: "Amount (USD)", type: "number", default: "100" },
            { key: "reason", label: "Audited reason", type: "text", default: "" },
          ]}
          endpoint={`/api/admin/groups/${groupId}/balance`}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "pnl" && (
        <BulkDialog
          title={`Set P/L — ${groupName}`}
          subtitle={`Sets a target gross P/L for ALL open positions across all ${memberCount} members.`}
          fields={[
            { key: "targetProfit", label: "Target profit (USD)", type: "number", default: "0" },
            { key: "reason", label: "Audited reason", type: "text", default: "" },
          ]}
          endpoint={`/api/admin/groups/${groupId}/pnl`}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

interface BulkField {
  key: string;
  label: string;
  type: "select" | "number" | "text";
  options?: string[];
  default: string;
}

function BulkDialog({ title, subtitle, fields, endpoint, onClose }: {
  title: string;
  subtitle: string;
  fields: BulkField[];
  endpoint: string;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.default])),
  );
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        payload[f.key] = f.type === "number" ? Number(values[f.key]) : values[f.key];
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const parts = [];
      if (data.successCount != null) parts.push(`${data.successCount} succeeded`);
      if (data.positionsAdjusted != null) parts.push(`${data.positionsAdjusted} positions adjusted`);
      if (data.failureCount) parts.push(`${data.failureCount} failed`);
      setResult(parts.join(", "));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-w-md rounded-xl p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
        {err && <Alert tone="err" className="mb-3">{err}</Alert>}
        {result && <Alert tone="ok" className="mb-3">{result}</Alert>}
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <Label className="mb-1 block text-xs text-muted-foreground">{f.label}</Label>
              {f.type === "select" ? (
                <NativeSelect
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                >
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </NativeSelect>
              ) : (
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}><X size={13} strokeWidth={2} aria-hidden /> Close</Button>
          <Button type="button" onClick={() => void submit()} disabled={saving} loading={saving} loadingLabel="Processing">
            <Play size={13} strokeWidth={2} aria-hidden /> Execute
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsEditor({ groupId, initial, onSaved }: { groupId: string; initial: UserSettingsConfig; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const save = async (settings: UserSettingsConfig) => {
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save settings");
      }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {saveErr && <Alert tone="err">{saveErr}</Alert>}
      <SettingsForm initial={initial} onSave={save} saving={saving} saveLabel="Save Group Settings" />
    </div>
  );
}

function SettingsPreview({ settings }: { settings: Record<string, unknown> }) {
  const keys = Object.keys(settings);
  if (keys.length === 0) {
    return (
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground">No custom settings configured — using global defaults.</p>
      </div>
    );
  }
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Active Settings</p>
      <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">{JSON.stringify(settings, null, 2)}</pre>
    </div>
  );
}

// ─── Collapsible section + settings display helpers ──────────────────────────

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/60/50 transition"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-muted-foreground transition-transform shrink-0 ${open ? "rotate-90" : ""}`}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

interface FieldDef {
  key: string;
  label: string;
  type: "bool" | "value" | "list";
  prefix?: string;
  suffix?: string;
}

function getCategoryItems(settings: Record<string, unknown>, category: string, fields: FieldDef[]) {
  const cat = settings[category] as Record<string, unknown> | undefined;
  if (!cat) return [];
  return fields
    .filter((f) => cat[f.key] !== undefined && cat[f.key] !== null)
    .map((f) => {
      const val = cat[f.key];
      if (f.type === "bool") {
        return { label: f.label, value: val === true ? "On" : "Off", isBool: true, boolVal: val === true };
      }
      if (f.type === "list") {
        return { label: f.label, value: Array.isArray(val) ? val.join(", ") : String(val) };
      }
      const formatted = f.prefix ?? "";
      const num = typeof val === "number" ? val.toString() : String(val);
      return { label: f.label, value: `${formatted}${num}${f.suffix ?? ""}` };
    });
}

function SettingsCategory({ label, items }: { label: string; items: Array<{ label: string; value: string; isBool?: boolean; boolVal?: boolean }> }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border last:border-0">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">{item.label}:</span>
            {item.isBool ? (
              <span className={`rounded px-1.5 py-0.5 font-semibold ${item.boolVal ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
                {item.value}
              </span>
            ) : (
              <span className="font-mono text-foreground">{item.value}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
