import type { ReportDef } from "@/server/reports/engine";

/**
 * Prebuilt report library — every entry renders through the same engine.
 * IDs are stable (URLs/exports reference them).
 */
export const PREBUILT_REPORTS: ReportDef[] = [
  {
    id: "leads-by-source",
    name: "Leads by source",
    description: "Where new leads come from, by attributed source.",
    object: "LEAD",
    dateField: "createdAt",
    groupBy: { key: "source" },
  },
  {
    id: "leads-by-assignee",
    name: "Leads by assignee",
    description: "Lead volume and conversion per sales owner.",
    object: "LEAD",
    dateField: "createdAt",
    groupBy: { key: "assignee" },
  },
  {
    id: "lead-funnel",
    name: "Lead funnel",
    description: "Current leads per status (no date filter).",
    object: "LEAD",
    dateField: "createdAt",
    groupBy: { key: "statusName" },
  },
  {
    id: "leads-over-time",
    name: "New leads over time",
    description: "Monthly new-lead volume.",
    object: "LEAD",
    dateField: "createdAt",
    groupBy: { key: "createdAt", timeUnit: "month" },
  },
  {
    id: "conversions-by-campaign",
    name: "Conversions by campaign",
    description: "Converted leads per campaign.",
    object: "LEAD",
    dateField: "convertedAt",
    groupBy: { key: "campaignName" },
    fixed: { convertedOnly: true },
  },
  {
    id: "pipeline-by-stage",
    name: "Pipeline by stage",
    description: "Open opportunity count and value per stage.",
    object: "OPPORTUNITY",
    dateField: "createdAt",
    groupBy: { key: "stageName" },
    sums: ["value"],
    fixed: { openOnly: true },
  },
  {
    id: "pipeline-by-owner",
    name: "Pipeline by owner",
    description: "Open opportunity value per owner.",
    object: "OPPORTUNITY",
    dateField: "createdAt",
    groupBy: { key: "owner" },
    sums: ["value"],
    fixed: { openOnly: true },
  },
  {
    id: "won-over-time",
    name: "Closed-won over time",
    description: "Monthly won value.",
    object: "OPPORTUNITY",
    dateField: "closedAt",
    groupBy: { key: "closedAt", timeUnit: "month" },
    sums: ["value"],
    fixed: { wonOnly: true },
  },
  {
    id: "win-rate-by-pipeline",
    name: "Win rate by pipeline",
    description: "Won vs total closed per pipeline.",
    object: "OPPORTUNITY",
    dateField: "closedAt",
    groupBy: { key: "pipelineName" },
    fixed: { wonOnly: true },
  },
  {
    id: "tasks-by-owner",
    name: "Task throughput by owner",
    description: "Completed tasks per owner.",
    object: "TASK",
    dateField: "completedAt",
    groupBy: { key: "owner" },
  },
];

export function findReport(id: string): ReportDef | undefined {
  return PREBUILT_REPORTS.find((report) => report.id === id);
}
