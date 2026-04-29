import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowMissionDashboardInput, ShowMissionDashboardOutput } from "./contract.js";
import { ShowMissionDashboardInputSchema, ShowMissionDashboardOutputSchema } from "./schema.js";

export const SHOW_MISSION_DASHBOARD_CHILD: CommanderConsoleChildDefinition<ShowMissionDashboardInput, ShowMissionDashboardOutput> = {
  childCapabilityId: "show-mission-dashboard",
  inputSchema: ShowMissionDashboardInputSchema,
  outputSchema: ShowMissionDashboardOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-mission-dashboard", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-mission-dashboard", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = {
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
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `dashboard:${output.mission.missionId ?? "none"}`, evidenceRefs: output.candidates.map((candidate) => candidate.id), dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};