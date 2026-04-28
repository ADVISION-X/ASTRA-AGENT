import { createId } from "../../lib/local-runtime/ids.js";
import type {
  CommanderConsoleAbilityGroup,
  CommanderConsoleChildAbilityId,
  CreateCommanderConsoleAbilityGroupInput,
  CommanderHumanCommandInput,
} from "./contract.js";
import { listCommanderConsoleChildAbilityIds } from "./registry.js";
import { isMissionCommandType } from "./shared/command-policy.js";
import type {
  CommanderHumanCommandResult,
  CommanderReviewDecisionResult,
} from "./shared/commander-result.js";

const DEFAULT_HUMAN_GOAL = "Discover evidence-backed product opportunities from the active social feed.";

function toCommandStatus(status: "accepted" | "failed"): "accepted" | "failed" {
  return status;
}

async function buildHumanCommandResult(
  input: CreateCommanderConsoleAbilityGroupInput,
  commandInput: CommanderHumanCommandInput,
): Promise<CommanderHumanCommandResult> {
  const mission = await input.missionReadModel.readMission();
  const commandId = createId("human_command");
  const command = {
    commandId,
    commandType: commandInput.commandType,
    operatorRef: input.operatorRef ?? "commander-console:operator",
    createdAt: (input.now ?? (() => new Date().toISOString()))(),
    targetMissionId: commandInput.targetMissionId ?? mission.missionId ?? null,
    selectedMapId: commandInput.selectedMapId ?? mission.selectedMapId ?? null,
    targetRecordRef: commandInput.targetRecordRef ?? null,
    requestedPlatformId: commandInput.requestedPlatformId ?? null,
    humanGoal: commandInput.humanGoal?.trim() || mission.humanGoal || DEFAULT_HUMAN_GOAL,
    initialPayload: {
      requestedBy: "commander-console",
      ...(commandInput.initialPayload ?? {}),
    },
    operatorNote: commandInput.operatorNote?.trim() || null,
  };
  const result = await input.commandTransport.emitHumanCommand(command);

  return {
    commandId,
    commandType: commandInput.commandType,
    status: toCommandStatus(result.status),
    envelopeRef: result.envelopeRef,
    mission: await input.missionReadModel.readMission(),
    failureReason: result.failureReason,
  };
}

async function buildReviewDecisionResult(
  input: CreateCommanderConsoleAbilityGroupInput,
  commandType: Extract<CommanderHumanCommandInput["commandType"], "approve-candidate" | "reject-candidate" | "mark-review-required">,
  candidateId: string,
  note?: string,
): Promise<CommanderReviewDecisionResult> {
  const commandId = createId("human_command");
  const result = await input.commandTransport.emitHumanCommand({
    commandId,
    commandType,
    operatorRef: input.operatorRef ?? "commander-console:operator",
    createdAt: (input.now ?? (() => new Date().toISOString()))(),
    targetMissionId: null,
    selectedMapId: null,
    targetRecordRef: { recordType: "candidate", recordId: candidateId },
    requestedPlatformId: null,
    humanGoal: null,
    initialPayload: { requestedBy: "commander-console" },
    operatorNote: note?.trim() || null,
  });

  return {
    commandId,
    commandType,
    status: toCommandStatus(result.status),
    envelopeRef: result.envelopeRef,
    targetRecordId: candidateId,
    failureReason: result.failureReason,
  };
}

export function createCommanderConsoleAbilityGroup(input: CreateCommanderConsoleAbilityGroupInput): CommanderConsoleAbilityGroup {

  const commanderConsole: CommanderConsoleAbilityGroup = {
    listChildAbilityIds() {
      return listCommanderConsoleChildAbilityIds() as CommanderConsoleChildAbilityId[];
    },
    async issueHumanCommand(commandInput) {
      if (!isMissionCommandType(commandInput.commandType)) {
        throw new Error(`Commander Console mission command expected, received ${commandInput.commandType}.`);
      }

      return buildHumanCommandResult(input, commandInput);
    },
    async showMissionDashboard() {
      return {
        mission: await input.missionReadModel.readMission(),
        runtime: await input.capabilityHealthReadModel.readRuntimeSummary(),
        browser: await input.capabilityHealthReadModel.readBrowserSummary(),
        health: await input.capabilityHealthReadModel.listHealthSummaries(),
        capabilityRoster: await input.capabilityHealthReadModel.listCapabilityRoster(),
        candidates: await input.forensicsReadModel.listCandidates(),
        reviewQueue: await input.forensicsReadModel.listReviewQueue(),
        evidencePackets: await input.forensicsReadModel.listEvidencePackets(),
        browseLedger: await input.forensicsReadModel.listBrowseLedger(),
        failedRecords: await input.forensicsReadModel.listFailedRecords(),
        runtimeProof: await input.runtimeProofReadModel.listRuntimeProofEntries(),
        auditSummary: await input.auditReadModel.readAuditSummary(),
      };
    },
    async showCapabilityRoster() {
      return input.capabilityHealthReadModel.listCapabilityRoster();
    },
    async showCapabilityHealth() {
      return input.capabilityHealthReadModel.listHealthSummaries();
    },
    async showOperationalMapProgress() {
      return input.missionReadModel.readMission();
    },
    async showRuntimeProofTimeline(limit = 50) {
      return input.runtimeProofReadModel.listRuntimeProofEntries(limit);
    },
    async showEvidencePackets(limit = 50) {
      return input.forensicsReadModel.listEvidencePackets(limit);
    },
    async showBrowseLedger(limit = 50) {
      return input.forensicsReadModel.listBrowseLedger(limit);
    },
    async showFailedRecords(limit = 50) {
      return input.forensicsReadModel.listFailedRecords(limit);
    },
    async showReviewQueue() {
      return input.forensicsReadModel.listReviewQueue();
    },
    async showAuditSummary() {
      return input.auditReadModel.readAuditSummary();
    },
    async pauseMission(note) {
      return buildHumanCommandResult(input, { commandType: "pause-mission", operatorNote: note ?? null });
    },
    async resumeMission(note) {
      return buildHumanCommandResult(input, { commandType: "resume-mission", operatorNote: note ?? null });
    },
    async stopMission(note) {
      return buildHumanCommandResult(input, { commandType: "stop-mission", operatorNote: note ?? null });
    },
    async emergencyStop(note) {
      return buildHumanCommandResult(input, { commandType: "emergency-stop", operatorNote: note ?? null });
    },
    async approveCandidate(candidateId, note) {
      return buildReviewDecisionResult(input, "approve-candidate", candidateId, note);
    },
    async rejectCandidate(candidateId, note) {
      return buildReviewDecisionResult(input, "reject-candidate", candidateId, note);
    },
    async markReviewRequired(candidateId, note) {
      return buildReviewDecisionResult(input, "mark-review-required", candidateId, note);
    },
    async inspectRecordDetail(recordId) {
      return input.forensicsReadModel.inspectRecordDetail(recordId);
    },
  };

  return commanderConsole;
}