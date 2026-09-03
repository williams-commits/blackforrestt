import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Role dashboard metrics. One endpoint; the actor's scope decides what the
 * numbers cover (rep = own work, manager/admin = the visible org).
 */
export async function GET() {
  try {
    const ctx = await scopedContext("DASHBOARDS_VIEW");
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const leadScope = assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
    const ownerScope = ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);

    const [
      openLeads,
      newLeads30d,
      convertedLeads30d,
      openOpportunities,
      wonThisMonth,
      openTasks,
      activity7d,
    ] = await Promise.all([
      prisma.lead.count({ where: { deletedAt: null, convertedAt: null, ...leadScope } }),
      prisma.lead.count({
        where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo }, ...leadScope },
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
      prisma.task.count({
        where: { ownerUserId: ctx.userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.activityEvent.count({
        where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    return NextResponse.json({
      data: {
        scope: ctx.scope,
        openLeads,
        newLeads30d,
        convertedLeads30d,
        openOpportunityCount: openOpportunities._count._all,
        openPipelineValue: openOpportunities._sum.value?.toString() ?? "0",
        wonThisMonthCount: wonThisMonth._count._all,
        wonThisMonthValue: wonThisMonth._sum.value?.toString() ?? "0",
        myOpenTasks: openTasks,
        activity7d,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load dashboard.");
  }
}
