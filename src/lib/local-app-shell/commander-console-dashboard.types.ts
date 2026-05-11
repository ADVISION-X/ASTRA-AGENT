/**
 * Commander Console Dashboard Types — owned by the UI shell layer.
 *
 * These types are used by the local-app-shell to render the commander console UI.
 * They are assembled by the workbench from local runtime state.
 * Commander-console capability only provides a minimal CommanderMissionStatusView.
 */
import type { WorkbenchCommanderMissionDashboardView } from "../local-runtime/workbench-commander-types.js";

export type CommanderMissionDashboardView = WorkbenchCommanderMissionDashboardView;

export type CommanderMissionView = WorkbenchCommanderMissionDashboardView["mission"];
export type CommanderRuntimeSummaryView = WorkbenchCommanderMissionDashboardView["runtime"];
export type CommanderBrowserSummaryView = WorkbenchCommanderMissionDashboardView["browser"];
export type CommanderCapabilityHealthEntry = WorkbenchCommanderMissionDashboardView["health"][number];
export type CommanderCapabilityRosterEntry = WorkbenchCommanderMissionDashboardView["capabilityRoster"][number];
export type CommanderCandidateView = WorkbenchCommanderMissionDashboardView["candidates"][number];
export type CommanderRecordSummaryView = WorkbenchCommanderMissionDashboardView["evidencePackets"][number];
export type CommanderRuntimeProofTimelineEntry = WorkbenchCommanderMissionDashboardView["runtimeProof"][number];
export type CommanderAuditSummary = WorkbenchCommanderMissionDashboardView["auditSummary"];
export type CommanderRecordDetailView = {
  recordType: string;
  recordId: string | null;
  title: string;
  summary: string;
  details: string[];
  status: string | null;
  createdAt: string | null;
};