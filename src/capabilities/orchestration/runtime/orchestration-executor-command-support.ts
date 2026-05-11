import { randomUUID } from "node:crypto";
import type { MissionCommand, MissionState } from "../contract.js";
import { PayloadRefBundleSchema } from "../schema.js";
import { buildMissionStateUpdate } from "./orchestration-result-builder.js";

export const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

export function createEmptyPayloadRefs() {
  return PayloadRefBundleSchema.parse({});
}

function buildInitialPayloadRefs(command: MissionCommand) {
  return PayloadRefBundleSchema.parse({
    requestedPlatformId: command.requestedPlatform,
    userRequirementRef: command.initialPayload.userRequirementRef,
    operatorNote: command.initialPayload.operatorNote,
    targetUrl: command.initialPayload.targetUrl,
    targetProfileRef: command.initialPayload.targetProfileRef,
    sourceEvidenceRef: command.initialPayload.sourceEvidenceRef,
    sourceTargetRef: command.initialPayload.sourceTargetRef,
    promptInputRef: command.initialPayload.promptInputRef,
    commandInputRef: command.initialPayload.commandInputRef,
  });
}

function buildInitialMissionRuntimeState(
  command: MissionCommand,
  startedAt: string,
) {
  const runLockId = `${command.missionId}:${randomUUID()}`;
  return {
    requestedPlatform: command.requestedPlatform,
    userRequirementRef: command.initialPayload.userRequirementRef,
    selectedPlatforms: command.initialPayload.selectedPlatforms,
    humanGoal: command.humanGoal,
    configuredMaxRounds: command.maxRounds ?? null,
    configuredMaxMinutes: command.maxMinutes ?? null,
    status: "running" as const,
    currentStepId: null,
    previousStepId: null,
    activeTaskRunId: command.runId,
    currentRoundIndex: 0,
    sequenceNo: 0,
    stateRevision: 0,
    hopCount: 0,
    reviewRequiredReason: null,
    failureReason: null,
    lastHumanCommand: "start-mission" as const,
    lastEnvelopeId: null,
    lastResultRef: null,
    lastRuntimeProofRef: null,
    runtimeProofRefs: [],
    payloadRefs: buildInitialPayloadRefs(command),
    runLockId,
    cancellationTokenRef: `cancel:${command.missionId}:${runLockId}`,
    resumeCheckpointRef: null,
    emergencyStopLatched: false,
    startedAt,
    updatedAt: startedAt,
    pausedAt: null,
    endedAt: null,
  };
}

export function createFailedMissionState(input: {
  missionId: string | null;
  runId?: string | null;
  requestedPlatform: MissionState["requestedPlatform"];
  humanGoal: string | null;
  lastHumanCommand: "start-mission" | "resume-mission";
  failureReason: string | null;
  startedAt: string;
  endedAt: string;
}): MissionState {
  return buildMissionStateUpdate({
    missionId: input.missionId,
    promptContractVersion: null,
    capabilityCatalogVersion: null,
    requestedPlatform: input.requestedPlatform,
    humanGoal: input.humanGoal,
    status: "failed",
    currentStepId: null,
    previousStepId: null,
    activeTaskRunId: input.runId ?? (input.missionId ? `${input.missionId}:failure-run` : "orchestration:unknown-mission:failure-run"),
    currentRoundIndex: 0,
    sequenceNo: 0,
    hopCount: 0,
    reviewRequiredReason: null,
    failureReason: input.failureReason,
    lastHumanCommand: input.lastHumanCommand,
    lastEnvelopeId: null,
    lastResultRef: null,
    lastRuntimeProofRef: null,
    runtimeProofRefs: [],
    payloadRefs: createEmptyPayloadRefs(),
    runLockId: null,
    cancellationTokenRef: null,
    resumeCheckpointRef: null,
    emergencyStopLatched: false,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    pausedAt: null,
    endedAt: input.endedAt,
  });
}

export function createInitialMissionState(
  command: MissionCommand,
  startedAt: string,
): MissionState {
  return buildMissionStateUpdate({
    missionId: command.missionId,
    ...buildInitialMissionRuntimeState(command, startedAt),
  });
}
