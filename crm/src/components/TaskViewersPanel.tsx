"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

/**
 * Viewer management for one task (owner or admin only). Users and whole
 * teams tagged here can VIEW the task (list, detail, comments) without
 * being owners — they cannot edit it. Saves are replace-all PATCHes, so
 * the chip list is the single source of truth.
 */
export function TaskViewersPanel({
  taskId,
  initialUsers,
  initialTeams,
  canManage,
}: {
  taskId: string;
  initialUsers: Array<{ id: string; name: string }>;
  initialTeams: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [viewerUserIds, setViewerUserIds] = useState(initialUsers.map((user) => user.id));
  const [viewerTeamIds, setViewerTeamIds] = useState(initialTeams.map((team) => team.id));
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    void fetch("/api/users").then((r) => r.ok ? r.json() : null).then((b) => setUsers((b?.data ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))).catch(() => setUsers([]));
    void fetch("/api/teams").then((r) => r.ok ? r.json() : null).then((b) => setTeams((b?.data ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })))).catch(() => setTeams([]));
  }, [canManage]);

  async function save(nextUserIds: string[], nextTeamIds: string[]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerUserIds: nextUserIds, viewerTeamIds: nextTeamIds }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = payload?.error ?? "Could not save viewers.";
        setError(message);
        toast.error("Viewers not saved", message);
        return;
      }
      setViewerUserIds(nextUserIds);
      setViewerTeamIds(nextTeamIds);
      toast.success("Viewers saved", "The task's viewer list is updated.");
      window.setTimeout(() => router.refresh(), 150);
    } catch {
      setError("Could not save viewers.");
    } finally {
      setBusy(false);
    }
  }

  const userById = new Map(users.map((user) => [user.id, user.name]));
  const teamById = new Map(teams.map((team) => [team.id, team.name]));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {viewerUserIds.length === 0 && viewerTeamIds.length === 0 ? (
          <p className="text-sm text-(--text-tertiary)">Only the owner and admins can see this task.</p>
        ) : (
          viewerUserIds.map((id) => (
            <span key={`u-${id}`} className="badge badge-neutral">
              {userById.get(id) ?? initialUsers.find((user) => user.id === id)?.name ?? `user …${id.slice(-6)}`}
              {canManage ? (
                <button type="button" aria-label="Remove viewer" disabled={busy} onClick={() => void save(viewerUserIds.filter((entry) => entry !== id), viewerTeamIds)} className="ml-1 text-(--text-tertiary) hover:text-(--error)">×</button>
              ) : null}
            </span>
          ))
        )}
        {viewerTeamIds.map((id) => (
          <span key={`t-${id}`} className="badge badge-neutral">
            {teamById.get(id) ?? initialTeams.find((team) => team.id === id)?.name ?? `team …${id.slice(-6)}`} (team)
            {canManage ? (
              <button type="button" aria-label="Remove team viewer" disabled={busy} onClick={() => void save(viewerUserIds, viewerTeamIds.filter((entry) => entry !== id))} className="ml-1 text-(--text-tertiary) hover:text-(--error)">×</button>
            ) : null}
          </span>
        ))}
      </div>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Add user viewer"
            value=""
            disabled={busy}
            onChange={(event) => {
              if (event.target.value) void save([...new Set([...viewerUserIds, event.target.value])], viewerTeamIds);
              event.target.value = "";
            }}
            className="input w-44"
          >
            <option value="">+ User…</option>
            {users.filter((user) => !viewerUserIds.includes(user.id)).map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          <select
            aria-label="Add team viewer"
            value=""
            disabled={busy}
            onChange={(event) => {
              if (event.target.value) void save(viewerUserIds, [...new Set([...viewerTeamIds, event.target.value])]);
              event.target.value = "";
            }}
            className="input w-44"
          >
            <option value="">+ Team…</option>
            {teams.filter((team) => !viewerTeamIds.includes(team.id)).map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-xs text-(--error)">{error}</p> : null}
    </div>
  );
}
