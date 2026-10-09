"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";

export interface PipelineStage {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

export interface RecentActivityEntry {
  id: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  actorName: string | null;
  excerpt: string | null;
  createdAt: string;
}

export interface DashboardData {
  scope: string;
  openLeads: number;
  newLeads30d: number;
  newLeadsPrev30d: number;
  convertedLeads30d: number;
  openOpportunityCount: number;
  openPipelineValue: string;
  wonThisMonthCount: number;
  wonThisMonthValue: string;
  wonLastMonthCount: number;
  wonLastMonthValue: string;
  myOpenTasks: number;
  myOverdueTasks: number;
  myTasksDueToday: number;
  totalCustomers: number;
  totalUsers: number;
  activity7d: number;
  pipelineStages: PipelineStage[];
  /** Present only when the actor holds audit access (admins). */
  recentActivity?: RecentActivityEntry[];
}

/** The one dashboard fetch every home section rides — TanStack caches it
 *  under ["dashboard"], so N sections still cost one request and record
 *  mutations invalidate it centrally. */
export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiGet<{ data: DashboardData }>("/api/dashboards"),
    select: (body) => body.data,
    staleTime: 60_000,
  });
}

/** Money is stored in minor units (cents) — render whole-dollar USD. */
export function money(minor: string | number): string {
  return (Number(minor) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
