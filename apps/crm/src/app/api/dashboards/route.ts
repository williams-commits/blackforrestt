import { NextResponse } from "next/server";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
import { scopedContext } from "@/server/records/leads";
import { requireAnyPermission } from "@/server/guard";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Role dashboard metrics. One endpoint; the actor's scope decides what the
 * numbers cover (rep = own work, manager/admin = the visible org).
 *
 * The operational fields (deltas, task attention counters, pipeline stage
 * distribution, recent activity) exist to feed the home workspace — every
 * number is computed from the same scoped rows the CRM already maintains.
 */
export async function GET() {
  try {
    const ctx = await scopedContext("DASHBOARDS_VIEW");
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * day);
    const prevThirtyDaysAgo = new Date(thirtyDaysAgo.getTime() - 30 * day);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + day);

    const leadScope = assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
    const ownerScope = ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
    const myOpenTaskWhere = {
      ownerUserId: ctx.userId,
      status: { in: ["OPEN", "IN_PROGRESS"] satisfies TaskStatus[] },
    };

    const [
      openLeads,
      newLeads30d,
      newLeadsPrev30d,
      convertedLeads30d,
      openOpportunities,
      wonThisMonth,
      wonLastMonth,
      openTasks,
      overdueTasks,
      tasksDueToday,
      activity7d,
      totalCustomers,
      totalUsers,
      leadStatuses,
      stageCounts,
    ] = await Promise.all([
      prisma.lead.count({ where: { deletedAt: null, convertedAt: null, ...leadScope } }),
      prisma.lead.count({
        where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo }, ...leadScope },
      }),
      prisma.lead.count({
        where: { deletedAt: null, createdAt: { gte: prevThirtyDaysAgo, lt: thirtyDaysAgo }, ...leadScope },
      }),
      prisma.lead.count({
        where: { deletedAt: null, convertedAt: { gte: thirtyDaysAgo }, ...leadScope },
      }),
      prisma.opportunity.aggregate({
        where: { deletedAt: null, status: "OPEN", ...ownerScope },
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.opportunity.aggregate({
        where: {
          deletedAt: null,
          status: "WON",
          closedAt: { gte: monthStart },
          ...ownerScope,
        },
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.opportunity.aggregate({
        where: {
          deletedAt: null,
          status: "WON",
          closedAt: { gte: lastMonthStart, lt: monthStart },
          ...ownerScope,
        },
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.task.count({ where: myOpenTaskWhere }),
      prisma.task.count({ where: { ...myOpenTaskWhere, dueAt: { lt: now } } }),
      prisma.task.count({ where: { ...myOpenTaskWhere, dueAt: { gte: todayStart, lt: tomorrowStart } } }),
      prisma.activityEvent.count({
        where: { createdAt: { gte: new Date(now.getTime() - 7 * day) } },
      }),
      prisma.customer.count({ where: { deletedAt: null, ...ownerScope } }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.recordStatus.findMany({
        where: { appliesTo: "LEAD" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, color: true },
      }),
      prisma.lead.groupBy({
        by: ["statusId"],
        where: { deletedAt: null, convertedAt: null, ...leadScope },
        _count: { _all: true },
      }),
    ]);

    const countByStatus = new Map(stageCounts.map((row) => [row.statusId, row._count._all]));
    const pipelineStages = leadStatuses
      .map((status) => ({
        id: status.id,
        name: status.name,
        color: status.color,
        count: countByStatus.get(status.id) ?? 0,
      }))
      .filter((stage) => stage.count > 0);

    // Team activity mirrors /api/audit's gate: only actors holding
    // ADMIN_ACCESS or AUDIT_VIEW get the feed; everyone else simply omits it
    // and the dashboard renders its context row without the feed card.
    let recentActivity:
      | Array<{
          id: string;
          kind: string;
          subjectType: string;
          subjectId: string;
          actorName: string | null;
          excerpt: string | null;
          createdAt: string;
        }>
      | undefined;
    let hasActivityAccess = false;
    try {
      await requireAnyPermission("ADMIN_ACCESS", "AUDIT_VIEW");
      hasActivityAccess = true;
    } catch {
      hasActivityAccess = false;
    }
    if (hasActivityAccess) {
      const events = await prisma.activityEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true } } },
      });
      recentActivity = events.map((event) => ({
        id: event.id,
        kind: event.kind,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        actorName: event.actor?.name ?? null,
        excerpt:
          event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
            ? typeof (event.payload as { excerpt?: unknown }).excerpt === "string"
              ? ((event.payload as { excerpt: string }).excerpt satisfies string).slice(0, 96)
              : null
            : null,
        createdAt: event.createdAt.toISOString(),
      }));
    }

    return NextResponse.json({
      data: {
        scope: ctx.scope,
        openLeads,
        newLeads30d,
        newLeadsPrev30d,
        convertedLeads30d,
        openOpportunityCount: openOpportunities._count._all,
        openPipelineValue: openOpportunities._sum.value?.toString() ?? "0",
        wonThisMonthCount: wonThisMonth._count._all,
        wonThisMonthValue: wonThisMonth._sum.value?.toString() ?? "0",
        wonLastMonthCount: wonLastMonth._count._all,
        wonLastMonthValue: wonLastMonth._sum.value?.toString() ?? "0",
        myOpenTasks: openTasks,
        myOverdueTasks: overdueTasks,
        myTasksDueToday: tasksDueToday,
        totalCustomers,
        totalUsers,
        activity7d,
        pipelineStages,
        recentActivity,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load dashboard.");
  }
}
