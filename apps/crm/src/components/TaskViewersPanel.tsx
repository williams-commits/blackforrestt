"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Viewer management for one task (owner or admin only). Users and whole
 * teams tagged here can VIEW the task (list, detail, comments) without
 * being owners — they cannot edit it. Saves are replace-all PATCHes, so
 * the chip list is the single source of truth. Directories and the save
 * ride the shared query caches.
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
  const queryClient = useQueryClient();
  const [viewerUserIds, setViewerUserIds] = useState(initialUsers.map((user) => user.id));
  const [viewerTeamIds, setViewerTeamIds] = useState(initialTeams.map((team) => team.id));
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: queryKeys.directories.users,
    queryFn: () => apiGet<{ data: Array<{ id: string; name: string }> }>("/api/users"),
    enabled: canManage,
    select: (body) => (body.data ?? []).map((user) => ({ id: user.id, name: user.name })),
  });
  const teamsQuery = useQuery({
    queryKey: queryKeys.directories.teams,
    queryFn: () => apiGet<{ data: Array<{ id: string; name: string }> }>("/api/teams"),
    enabled: canManage,
    select: (body) => (body.data ?? []).map((team) => ({ id: team.id, name: team.name })),
  });
  const users = usersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async ({ users: nextUserIds, teams: nextTeamIds }: { users: string[]; teams: string[] }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerUserIds: nextUserIds, viewerTeamIds: nextTeamIds }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not save viewers.");
      }
      return { users: nextUserIds, teams: nextTeamIds };
    },
    onSuccess: (saved) => {
      setViewerUserIds(saved.users);
      setViewerTeamIds(saved.teams);
      toast.success("Viewers saved", { description: "The task's viewer list is updated." });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.viewers(taskId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root });
      window.setTimeout(() => router.refresh(), 150);
    },
    onError: (caught) => {
      const message = caught instanceof Error ? caught.message : "Could not save viewers.";
      setError(message);
      toast.error("Viewers not saved", { description: message });
    },
  });
  const busy = saveMutation.isPending;

  async function save(nextUserIds: string[], nextTeamIds: string[]) {
    if (busy) return;
    setError(null);
    await saveMutation.mutateAsync({ users: nextUserIds, teams: nextTeamIds }).catch(() => undefined);
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
            <Badge key={`u-${id}`} className="badge badge-neutral">
              {userById.get(id) ?? initialUsers.find((user) => user.id === id)?.name ?? `user …${id.slice(-6)}`}
              {canManage ? (
                <button type="button" aria-label="Remove viewer" disabled={busy} onClick={() => void save(viewerUserIds.filter((entry) => entry !== id), viewerTeamIds)} className="ml-1 text-(--text-tertiary) hover:text-(--error)">×</button>
              ) : null}
            </Badge>
          ))
        )}
        {viewerTeamIds.map((id) => (
          <Badge key={`t-${id}`} className="badge badge-neutral">
            {teamById.get(id) ?? initialTeams.find((team) => team.id === id)?.name ?? `team …${id.slice(-6)}`} (team)
            {canManage ? (
              <button type="button" aria-label="Remove team viewer" disabled={busy} onClick={() => void save(viewerUserIds, viewerTeamIds.filter((entry) => entry !== id))} className="ml-1 text-(--text-tertiary) hover:text-(--error)">×</button>
            ) : null}
          </Badge>
        ))}
      </div>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value="__none__"
            disabled={busy}
            onValueChange={(value) => {
              if (value !== "__none__") void save([...new Set([...viewerUserIds, value])], viewerTeamIds);
            }}
          >
            <SelectTrigger size="sm" aria-label="Add user viewer" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="__none__">+ User…</SelectItem>
              {users.filter((user) => !viewerUserIds.includes(user.id)).map((user) => (
                <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value="__none__"
            disabled={busy}
            onValueChange={(value) => {
              if (value !== "__none__") void save(viewerUserIds, [...new Set([...viewerTeamIds, value])]);
            }}
          >
            <SelectTrigger size="sm" aria-label="Add team viewer" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="__none__">+ Team…</SelectItem>
              {teams.filter((team) => !viewerTeamIds.includes(team.id)).map((team) => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-xs text-(--error)">{error}</p> : null}
    </div>
  );
}
