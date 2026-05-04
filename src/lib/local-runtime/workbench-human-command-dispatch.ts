import type { HumanCommandDispatchInput } from "../../capabilities/nerve-bus/contract.js";

import type { WorkbenchRuntime } from "./workbench-contract.js";
import { getActiveMapChain } from "./workbench-map-chain-support.js";
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
  selectedMapId: string | null;
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

const readStartMissionPayloadField = (
  command: HumanCommandDispatchCommand,
  key: "targetUrl" | "targetTitle" | "sourceEvidenceRef" | "sourceTargetRef" | "promptInputRef" | "commandInputRef" | "taskTemplateId",
) => {
  if (!isRecord(command.payload) || command.payload.kind !== "start-mission") {
    return null;
  }

  const value = command.payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

type HumanCommandChain = {
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string;
  videoVisitId: string | null;
  mapId: string;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
  capabilityCallId: string;
  sequenceNo: number;
};

type RequiredMapChain = {
  mapId: string;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
};

const buildHumanCommandInputContent = (command: HumanCommandDispatchCommand) => ({
  commandId: command.commandId,
  commandType: command.commandType,
  idempotencyKey: command.idempotencyKey,
  timeoutMs: command.timeoutMs,
  targetMissionId: command.targetMissionId ?? null,
  selectedMapId: command.selectedMapId ?? null,
  requestedPlatformId: command.requestedPlatformId ?? null,
  humanGoal: command.humanGoal ?? null,
  maxRounds: command.maxRounds ?? null,
  maxMinutes: command.maxMinutes ?? null,
  operatorNote: command.operatorNote ?? null,
  taskTemplateId: readStartMissionPayloadField(command, "taskTemplateId"),
  targetRecordId: command.targetRecordRef?.recordId ?? null,
  targetUrl: readStartMissionPayloadField(command, "targetUrl"),
  targetTitle: readStartMissionPayloadField(command, "targetTitle"),
  sourceEvidenceRef: readStartMissionPayloadField(command, "sourceEvidenceRef"),
  sourceTargetRef: readStartMissionPayloadField(command, "sourceTargetRef"),
  promptInputRef: readStartMissionPayloadField(command, "promptInputRef"),
  commandInputRef: readStartMissionPayloadField(command, "commandInputRef"),
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

const resolveRequiredMapChain = (mapId: string | null, missingChainMessage: string): RequiredMapChain => {
  const mapChain = getActiveMapChain(mapId);
  if (!mapId || !mapChain.mapPackageId || !mapChain.mapPackageVersion || !mapChain.selectedMapVersion || !mapChain.activationId || !mapChain.activationSnapshotRef) {
    throw new Error(missingChainMessage);
  }

  return {
    mapId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationId: mapChain.activationId,
    activationSnapshotRef: mapChain.activationSnapshotRef,
  };
};

const resolveStartMissionChain = (
  command: HumanCommandDispatchCommand,
): HumanCommandChain => {
  if (!command.selectedMapId) {
    throw new Error("start-mission requires selectedMapId.");
  }

  const mapChain = resolveRequiredMapChain(command.selectedMapId, `Selected map ${command.selectedMapId} is not active.`);

  return {
    missionId: command.targetMissionId ?? command.commandId,
    runId: `${command.commandId}:run`,
    sessionId: command.targetMissionId ?? command.commandId,
    roundId: "0",
    videoVisitId: null,
    mapId: mapChain.mapId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationId: mapChain.activationId,
    activationSnapshotRef: mapChain.activationSnapshotRef,
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

  const mapChain = resolveRequiredMapChain(state.mapId, `${command.commandType} requires an active mission chain.`);

  return {
    missionId: state.missionId,
    runId: state.activeTaskRunId ?? `${state.missionId}:run`,
    sessionId: state.missionId,
    roundId: String(state.currentRoundIndex),
    videoVisitId: null,
    mapId: mapChain.mapId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationId: mapChain.activationId,
    activationSnapshotRef: mapChain.activationSnapshotRef,
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
      mapPackageId: chain.mapPackageId,
      mapPackageVersion: chain.mapPackageVersion,
      selectedMapVersion: chain.selectedMapVersion,
      activationId: chain.activationId,
      activationSnapshotRef: chain.activationSnapshotRef,
      stepId: command.commandType,
      capabilityCallId: chain.capabilityCallId,
      sourceRef: inputPayload.documentRef,
      inputRef: inputPayload.documentRef,
      payloadRefs: { input: inputPayload.documentRef },
      summary: inputPayload.summary,
      tags: ["commander-console", command.commandType],
      sequenceNo: chain.sequenceNo,
      idempotencyKey: command.idempotencyKey,
      expiresAt: new Date(Date.now() + command.timeoutMs).toISOString(),
    }),
    commandId: command.commandId,
    envelopeKind: "human_command" as const,
    from: "commander-console" as const,
    to: "orchestration" as const,
    commandType: command.commandType,
    commanderCommandRef: inputPayload.documentRef,
    commanderEnvelopeRef: envelopeId,
    requestedPlatformId: command.requestedPlatformId,
    taskTemplateId: readStartMissionPayloadField(command, "taskTemplateId"),
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
