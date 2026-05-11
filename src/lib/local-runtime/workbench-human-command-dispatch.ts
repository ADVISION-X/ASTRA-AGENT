import type { HumanCommandDispatchInput } from "../../capabilities/nerve-bus/contract.js";

import type { WorkbenchRuntime } from "./workbench-contract.js";
import { buildPayloadDocument, buildTransportEnvelopeBase } from "./workbench-payload.js";

type HumanCommandDispatchTargetRecordRef = {
  recordId: string;
};

type HumanCommandDispatchCommand = {
  commandId: string;
  idempotencyKey: string;
  timeoutMs: number;
  commandType: string;
  targetMissionId: string | null;
  requestedPlatformId: string | null;
  humanGoal: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  operatorNote: string | null;
  targetRecordRef: HumanCommandDispatchTargetRecordRef | null;
  payload?: unknown;
};

type HumanCommandTransportResultEnvelope = {
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const readStartMissionPayloadStringField = (
  command: HumanCommandDispatchCommand,
  key:
    | "targetUrl"
    | "targetTitle"
    | "targetProfileRef"
    | "sourceEvidenceRef"
    | "sourceTargetRef"
    | "promptInputRef"
    | "commandInputRef"
    | "userRequirementRef"
    | "primaryPlatformId",
) => {
  if (!isRecord(command.payload) || command.payload.kind !== "start-mission") {
    return null;
  }

  const value = command.payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const readStartMissionPayloadStringArrayField = (
  command: HumanCommandDispatchCommand,
  key: "selectedPlatforms",
) => {
  if (!isRecord(command.payload) || command.payload.kind !== "start-mission") {
    return null;
  }

  const value = command.payload[key];
  if (!Array.isArray(value)) {
    return null;
  }

  return JSON.stringify(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0));
};

type HumanCommandChain = {
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string;
  videoVisitId: string | null;
  mapId: string | null;
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  bindingVersion: string | null;
  bindingActivationRef: string | null;
  bindingSnapshotRef: string | null;
  capabilityCallId: string;
  sequenceNo: number;
};

const buildHumanCommandInputContent = (command: HumanCommandDispatchCommand) => ({
  commandId: command.commandId,
  commandType: command.commandType,
  idempotencyKey: command.idempotencyKey,
  timeoutMs: command.timeoutMs,
  targetMissionId: command.targetMissionId ?? null,
  requestedPlatformId: command.requestedPlatformId ?? null,
  humanGoal: command.humanGoal ?? null,
  maxRounds: command.maxRounds ?? null,
  maxMinutes: command.maxMinutes ?? null,
  operatorNote: command.operatorNote ?? null,
  targetRecordId: command.targetRecordRef?.recordId ?? null,
  targetUrl: readStartMissionPayloadStringField(command, "targetUrl"),
  targetTitle: readStartMissionPayloadStringField(command, "targetTitle"),
  targetProfileRef: readStartMissionPayloadStringField(command, "targetProfileRef"),
  sourceEvidenceRef: readStartMissionPayloadStringField(command, "sourceEvidenceRef"),
  sourceTargetRef: readStartMissionPayloadStringField(command, "sourceTargetRef"),
  promptInputRef: readStartMissionPayloadStringField(command, "promptInputRef"),
  commandInputRef: readStartMissionPayloadStringField(command, "commandInputRef"),
  userRequirementRef: readStartMissionPayloadStringField(command, "userRequirementRef"),
  primaryPlatformId: readStartMissionPayloadStringField(command, "primaryPlatformId"),
  selectedPlatformsJson: readStartMissionPayloadStringArrayField(command, "selectedPlatforms"),
});

const buildHumanCommandInputPayload = (command: HumanCommandDispatchCommand) => {
  return buildPayloadDocument({
    documentType: "human.command",
    documentRef: `commander-console:${command.commandId}:input`,
    summary: `Commander command ${command.commandType}`,
    content: buildHumanCommandInputContent(command),
  });
};

const createMissingMissionChainError = (commandType: string) => new Error(`${commandType} requires an active mission chain.`);

const resolveStartMissionChain = (
  command: HumanCommandDispatchCommand,
): HumanCommandChain => {
  return {
    missionId: command.targetMissionId ?? command.commandId,
    runId: `${command.commandId}:run`,
    sessionId: command.targetMissionId ?? command.commandId,
    roundId: "0",
    videoVisitId: null,
    mapId: null,
    bindingPackageId: null,
    bindingPackageVersion: null,
    bindingVersion: null,
    bindingActivationRef: null,
    bindingSnapshotRef: null,
    capabilityCallId: command.commandId,
    sequenceNo: 0,
  };
};

const resolveExistingMissionChain = async (
  runtime: WorkbenchRuntime,
  command: HumanCommandDispatchCommand,
): Promise<HumanCommandChain> => {
  const state = await runtime.orchestrationAbilityGroup.getMissionState();
  if (!state.missionId || (command.targetMissionId !== null && state.missionId !== command.targetMissionId)) {
    throw createMissingMissionChainError(command.commandType);
  }

  return {
    missionId: state.missionId,
    runId: state.activeTaskRunId ?? `${state.missionId}:run`,
    sessionId: state.missionId,
    roundId: String(state.currentRoundIndex),
    videoVisitId: null,
    mapId: state.mapId ?? null,
    bindingPackageId: null,
    bindingPackageVersion: null,
    bindingVersion: null,
    bindingActivationRef: null,
    bindingSnapshotRef: null,
    capabilityCallId: command.commandId,
    sequenceNo: state.currentRoundIndex,
  };
};

const resolveHumanCommandChain = async (
  runtime: WorkbenchRuntime,
  command: HumanCommandDispatchCommand,
): Promise<HumanCommandChain> => {
  if (command.commandType === "start-mission") {
    return resolveStartMissionChain(command);
  }
  return resolveExistingMissionChain(runtime, command);
};

const buildHumanCommandEnvelope = (
  command: HumanCommandDispatchCommand,
  inputPayload: ReturnType<typeof buildHumanCommandInputPayload>,
  chain: HumanCommandChain,
) => {
  const envelopeId = `commander-console:${command.commandId}`;
  const expiresAt = new Date(Date.now() + Math.max(command.timeoutMs, 30_000)).toISOString();
  return {
    ...buildTransportEnvelopeBase({
      channelId: "commander-to-orchestration",
      envelopeId,
      missionId: chain.missionId,
      runId: chain.runId,
      sessionId: chain.sessionId,
      roundId: chain.roundId,
      videoVisitId: chain.videoVisitId,
      mapId: chain.mapId,
      bindingPackageId: chain.bindingPackageId,
      bindingPackageVersion: chain.bindingPackageVersion,
      bindingVersion: chain.bindingVersion,
      bindingActivationRef: chain.bindingActivationRef,
      bindingSnapshotRef: chain.bindingSnapshotRef,
      stepId: command.commandType,
      capabilityCallId: chain.capabilityCallId,
      sourceRef: inputPayload.documentRef,
      inputRef: inputPayload.documentRef,
      payloadRefs: { input: inputPayload.documentRef },
      summary: inputPayload.summary,
      tags: ["commander-console", command.commandType],
      sequenceNo: chain.sequenceNo,
      idempotencyKey: command.idempotencyKey,
      expiresAt,
    }),
    commandId: command.commandId,
    envelopeKind: "human_command" as const,
    from: "commander-console" as const,
    to: "orchestration" as const,
    commandType: command.commandType,
    commanderCommandRef: inputPayload.documentRef,
    commanderEnvelopeRef: envelopeId,
    requestedPlatformId: command.requestedPlatformId,
    targetRecordRef: command.targetRecordRef?.recordId ?? null,
  };
};

export const buildHumanCommandDispatchInput = async (
  runtime: WorkbenchRuntime,
  command: HumanCommandDispatchCommand,
): Promise<HumanCommandDispatchInput> => {
  const inputPayload = buildHumanCommandInputPayload(command);
  const chain = await resolveHumanCommandChain(runtime, command);
  return {
    envelope: buildHumanCommandEnvelope(command, inputPayload, chain),
    inputPayload,
  };
};

export const describeHumanCommandTransportMessage = (
  resultEnvelope: HumanCommandTransportResultEnvelope,
): string => {
  if (resultEnvelope.status === "failed") {
    return resultEnvelope.failureReason ?? "command transport failed";
  }
  if (resultEnvelope.status === "review_required") {
    return resultEnvelope.failureReason ?? "command transport requires review";
  }
  return resultEnvelope.reviewRequiredReason ?? "command accepted";
};
