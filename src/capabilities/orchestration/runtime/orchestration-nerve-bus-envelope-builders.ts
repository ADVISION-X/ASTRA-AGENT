import type { OrchestrationNerveBusPort } from "../ports/orchestration-nerve-bus-port.js";

type SendAbilityInput = Parameters<OrchestrationNerveBusPort["sendCommandToAbility"]>[0];
type SendAiInput = Parameters<OrchestrationNerveBusPort["sendRequestToAi"]>[0];

type DispatchPayloadRefs = SendAbilityInput["payloadRefs"];
type SharedChannelId = "orchestration-to-ability" | "orchestration-to-ai";
type SharedEnvelopeInput = SendAbilityInput | SendAiInput;

const MAX_TRANSPORT_SUMMARY_LENGTH = 400;

function collectPayloadRefs(input: DispatchPayloadRefs, inputRef: string) {
  const refs = [inputRef, ...Object.values(input)].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return Array.from(new Set(refs));
}

function resolveSourceRef(payloadRefs: DispatchPayloadRefs, fallback: string): string {
  return payloadRefs.promptInputRef
    ?? payloadRefs.commandInputRef
    ?? payloadRefs.sourceEvidenceRef
    ?? payloadRefs.sourceTargetRef
    ?? fallback;
}

function buildCapabilityCallId(input: { missionId: string; stepId: string; sequenceNo: number; capabilityCallId?: string | null }, kind: string) {
  if (input.capabilityCallId) {
    return input.capabilityCallId;
  }
  return `${input.missionId}:${input.stepId}:${input.sequenceNo}:${kind}`;
}

function clampTransportSummary(summary: string) {
  return summary.length <= MAX_TRANSPORT_SUMMARY_LENGTH
    ? summary
    : `${summary.slice(0, MAX_TRANSPORT_SUMMARY_LENGTH - 3)}...`;
}

function buildEnvelopePayload(summary: string, refs: string[], tags: string[]) {
  return {
    summary: clampTransportSummary(summary),
    entityRefs: refs,
    evidenceRefs: refs,
    tags,
    attributes: [],
  };
}

function buildDispatchDocumentContent(payloadRefs: DispatchPayloadRefs) {
  return Object.fromEntries(
    Object.entries(payloadRefs).filter(([, value]) => value !== undefined),
  );
}

function buildOrchestrationSharedEnvelope<TTransportInput extends SharedEnvelopeInput, TChannelId extends SharedChannelId>(input: {
  transportInput: TTransportInput;
  channelId: TChannelId;
  envelopeId: string;
  inputRef: string;
  capabilityCallId: string;
  payloadRefs: string[];
  summary: string;
  tags: string[];
  createdAt: string;
  expiresAt: string;
}) {
  return buildSharedEnvelopeBase({
    channelId: input.channelId,
    envelopeId: input.envelopeId,
    missionId: input.transportInput.missionId,
    runId: input.transportInput.runId,
    sessionId: input.transportInput.sessionId,
    roundId: input.transportInput.roundId,
    videoVisitId: input.transportInput.videoVisitId,
    mapId: input.transportInput.mapId,
    mapPackageId: input.transportInput.mapPackageId,
    mapPackageVersion: input.transportInput.mapPackageVersion,
    selectedMapVersion: input.transportInput.selectedMapVersion,
    activationId: input.transportInput.activationId,
    activationSnapshotRef: input.transportInput.activationSnapshotRef,
    stepId: input.transportInput.stepId,
    capabilityCallId: input.capabilityCallId,
    sourceRef: resolveSourceRef(input.transportInput.payloadRefs, input.inputRef),
    inputRef: input.inputRef,
    payloadRefs: input.payloadRefs,
    summary: input.summary,
    tags: input.tags,
    sequenceNo: input.transportInput.sequenceNo,
    idempotencyKey: input.transportInput.idempotencyKey,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  });
}

function buildAbilityEnvelopeFields(input: SendAbilityInput, capabilityCallId: string, inputRef: string) {
  return {
    envelopeKind: "ability_command" as const,
    commandId: capabilityCallId,
    from: "orchestration" as const,
    to: input.targetAbilityGroupId,
    targetAbilityGroupId: input.targetAbilityGroupId,
    targetChildCapabilityId: input.childCapabilityId,
    commandName: input.childCapabilityId,
    capabilityInputRef: inputRef,
    expectedOutputSchemaRef: input.expectedOutputSchemaRef,
    postClickObservation: input.postClickObservation,
  };
}

function buildAiEnvelopeFields(input: SendAiInput, capabilityCallId: string) {
  return {
    envelopeKind: "ai_request" as const,
    requestId: capabilityCallId,
    from: "orchestration" as const,
    to: "ai" as const,
    taskType: input.taskType,
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptContractVersion,
    outputSchemaRef: input.outputSchemaRef,
    aiInputRefs: input.aiInputRefs,
    modelPolicyRef: null,
    providerPolicyRef: input.providerPolicyRef,
  };
}

function buildSharedEnvelopeBase<TChannelId extends SharedChannelId>(input: {
  channelId: TChannelId;
  envelopeId: string;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  mapId: string;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
  stepId: string;
  capabilityCallId: string;
  sourceRef: string;
  inputRef: string;
  payloadRefs: string[];
  summary: string;
  tags: string[];
  sequenceNo: number;
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string;
}) {
  return {
    abilityGroupId: "nerve-bus" as const,
    channelId: input.channelId,
    envelopeId: input.envelopeId,
    nerveBusEnvelopeId: input.envelopeId,
    transportId: input.envelopeId,
    traceId: `${input.missionId}:${input.mapId}:${input.runId}`,
    spanId: `${input.stepId}:${input.channelId}`,
    attemptId: `${input.envelopeId}:attempt:1`,
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    mapId: input.mapId,
    mapPackageId: input.mapPackageId,
    mapPackageVersion: input.mapPackageVersion,
    selectedMapId: input.mapId,
    selectedMapVersion: input.selectedMapVersion,
    activationId: input.activationId,
    activationSnapshotRef: input.activationSnapshotRef,
    stepId: input.stepId,
    capabilityCallId: input.capabilityCallId,
    sourceRef: input.sourceRef,
    idempotencyKey: input.idempotencyKey,
    sequenceNo: input.sequenceNo,
    inputRef: input.inputRef,
    payloadRef: input.payloadRefs,
    payload: buildEnvelopePayload(input.summary, input.payloadRefs, input.tags),
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  };
}

export function buildAbilityDispatchEnvelope(input: SendAbilityInput, envelopeId: string, createdAt: string, expiresAt: string) {
  const inputRef = `${input.missionId}:${input.stepId}:input`;
  const capabilityCallId = buildCapabilityCallId(input, "ability");
  const payloadRefs = collectPayloadRefs(input.payloadRefs, inputRef);
  return {
    ...buildOrchestrationSharedEnvelope({
      transportInput: input,
      channelId: "orchestration-to-ability",
      envelopeId,
      inputRef,
      capabilityCallId,
      payloadRefs,
      summary: `Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`,
      tags: [input.targetAbilityGroupId, input.childCapabilityId],
      createdAt,
      expiresAt,
    }),
    ...buildAbilityEnvelopeFields(input, capabilityCallId, inputRef),
  };
}

export function buildAbilityDispatchDocument(input: SendAbilityInput) {
  return {
    documentType: "orchestration.ability_dispatch" as const,
    documentRef: `${input.missionId}:${input.stepId}:input`,
    summary: clampTransportSummary(`Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`),
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: Object.entries(buildDispatchDocumentContent(input.payloadRefs)).map(([key, value]) => ({ key, value })),
  };
}

export function buildAiDispatchEnvelope(input: SendAiInput, envelopeId: string, createdAt: string, expiresAt: string) {
  const inputRef = `${input.missionId}:${input.stepId}:ai-input`;
  const capabilityCallId = buildCapabilityCallId(input, "ai");
  const payloadRefs = collectPayloadRefs(input.payloadRefs, inputRef);
  return {
    ...buildOrchestrationSharedEnvelope({
      transportInput: input,
      channelId: "orchestration-to-ai",
      envelopeId,
      inputRef,
      capabilityCallId,
      payloadRefs,
      summary: `Request AI prompt ${input.promptContractId}`,
      tags: ["ai", input.promptContractId],
      createdAt,
      expiresAt,
    }),
    ...buildAiEnvelopeFields(input, capabilityCallId),
  };
}

export function buildAiDispatchDocument(input: SendAiInput) {
  return {
    documentType: "orchestration.ai_dispatch" as const,
    documentRef: `${input.missionId}:${input.stepId}:ai-input`,
    summary: clampTransportSummary(`Request AI prompt ${input.promptContractId}`),
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: Object.entries(buildDispatchDocumentContent(input.payloadRefs)).map(([key, value]) => ({ key, value })),
  };
}
