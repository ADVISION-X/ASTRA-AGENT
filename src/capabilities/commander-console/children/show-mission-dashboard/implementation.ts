import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
import { SHOW_MISSION_DASHBOARD_CONTRACT, type ShowMissionDashboardInput, type ShowMissionDashboardOutput } from "./contract.js";
import { ShowMissionDashboardInputSchema, ShowMissionDashboardOutputSchema } from "./schema.js";

async function readMissionDashboard(context: Parameters<typeof executeCommanderReadChild<ShowMissionDashboardInput, ShowMissionDashboardOutput>>[0]["context"]): Promise<ShowMissionDashboardOutput> {
  return {
    mission: await context.missionReadModel.readMission(),
    runtime: await context.capabilityHealthReadModel.readRuntimeSummary(),
    browser: await context.capabilityHealthReadModel.readBrowserSummary(),
    health: await context.capabilityHealthReadModel.listHealthSummaries(),
    capabilityRoster: await context.capabilityHealthReadModel.listCapabilityRoster(),
    candidates: await context.forensicsReadModel.listCandidates(),
    reviewQueue: await context.forensicsReadModel.listReviewQueue(),
    evidencePackets: await context.forensicsReadModel.listEvidencePackets(),
    browseLedger: await context.forensicsReadModel.listBrowseLedger(),
    failedRecords: await context.forensicsReadModel.listFailedRecords(),
    runtimeProof: await context.runtimeProofReadModel.listRuntimeProofEntries(),
    auditSummary: await context.auditReadModel.readAuditSummary(),
  };
}

function buildMissionDashboardEvidenceRefs(output: ShowMissionDashboardOutput) {
  const refs = [];
  if (output.mission.missionId) {
    refs.push(buildCommanderEvidenceRef({
      recordType: "mission",
      recordId: output.mission.missionId,
      sourceAbility: "mission-read-model",
    }));
  }
  for (const candidate of output.candidates) {
    refs.push(buildCommanderEvidenceRef({ recordType: "candidate", recordId: candidate.id, sourceAbility: "forensics-read-model" }));
  }
  refs.push(buildCommanderEvidenceRef({
    recordType: "runtime-event",
    recordId: `audit-summary:${output.auditSummary.phase}:${output.auditSummary.lastRunGeneratedAt ?? output.auditSummary.lastGeneratedAt ?? "latest"}`,
    sourceAbility: "audit-read-model",
    proofRef: output.auditSummary.lastRunGeneratedAt ?? output.auditSummary.lastGeneratedAt ?? null,
  }));
  if (refs.length === 0) {
    refs.push(buildCommanderEvidenceRef({
      recordType: "runtime-event",
      recordId: "mission-dashboard:empty",
      sourceAbility: "capability-health-read-model",
    }));
  }
  return refs;
}

export const SHOW_MISSION_DASHBOARD_CHILD: CommanderConsoleChildDefinition<ShowMissionDashboardInput, ShowMissionDashboardOutput> = {
  ...SHOW_MISSION_DASHBOARD_CONTRACT,
  inputSchema: ShowMissionDashboardInputSchema,
  outputSchema: ShowMissionDashboardOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_MISSION_DASHBOARD_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowMissionDashboardInputSchema,
      context,
      read: () => readMissionDashboard(context),
      buildEvidenceRefs: buildMissionDashboardEvidenceRefs,
      buildOutputPolicy: (output) => ({ missionId: output.mission.missionId }),
    });
  },
};