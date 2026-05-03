import type { OrchestrationNerveBusPort } from "../ports/orchestration-nerve-bus-port.js";

type SendAbilityInput = Parameters<OrchestrationNerveBusPort["sendCommandToAbility"]>[0];
type SendAiInput = Parameters<OrchestrationNerveBusPort["sendRequestToAi"]>[0];
type SendReviewInput = Parameters<OrchestrationNerveBusPort["sendReviewRequestToCommander"]>[0];

type DispatchPayloadRefs = SendAbilityInput["payloadRefs"];
type SharedChannelId = "orchestration-to-ability" | "orchestration-to-ai" | "orchestration-to-commander";

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

function buildCapabilityCallId(input: { missionId: string; stepId: string; sequenceNo: number }, kind: string) {
  return `${input.missionId}:${input.stepId}:${input.sequenceNo}:${kind}`;
}

function buildEnvelopePayload(summary: string, refs: string[], tags: string[]) {
  return {
    summary,
    entityRefs: refs,
    evidenceRefs: refs,
    tags,
    attributes: [],
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
    ...buildSharedEnvelopeBase({
      channelId: "orchestration-to-ability",
      envelopeId,
      missionId: input.missionId,
      runId: input.runId,
      sessionId: input.sessionId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId,
      mapId: input.mapId,
      mapPackageId: input.mapPackageId,
      mapPackageVersion: input.mapPackageVersion,
      selectedMapVersion: input.selectedMapVersion,
      activationId: input.activationId,
      activationSnapshotRef: input.activationSnapshotRef,
      stepId: input.stepId,
      capabilityCallId,
      sourceRef: resolveSourceRef(input.payloadRefs, inputRef),
      inputRef,
      payloadRefs,
      summary: `Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`,
      tags: [input.targetAbilityGroupId, input.childCapabilityId],
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      createdAt,
      expiresAt,
    }),
    envelopeKind: "ability_command" as const,
    commandId: capabilityCallId,
    from: "orchestration" as const,
    to: input.targetAbilityGroupId,
    targetAbilityGroupId: input.targetAbilityGroupId,
    targetChildCapabilityId: input.childCapabilityId,
    commandName: input.childCapabilityId,
    capabilityInputRef: inputRef,
    expectedOutputSchemaRef: input.expectedOutputSchemaRef,
    postActionVerificationRequired: input.postActionVerificationRequired,
  };
}

export function buildAbilityDispatchDocument(input: SendAbilityInput) {
  return {
    documentType: "orchestration.ability_dispatch" as const,
    documentRef: `${input.missionId}:${input.stepId}:input`,
    summary: `Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`,
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: [],
  };
}

export function buildAiDispatchEnvelope(input: SendAiInput, envelopeId: string, createdAt: string, expiresAt: string) {
  const inputRef = `${input.missionId}:${input.stepId}:ai-input`;
  const capabilityCallId = buildCapabilityCallId(input, "ai");
  const payloadRefs = collectPayloadRefs(input.payloadRefs, inputRef);
  return {
    ...buildSharedEnvelopeBase({
      channelId: "orchestration-to-ai",
      envelopeId,
      missionId: input.missionId,
      runId: input.runId,
      sessionId: input.sessionId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId,
      mapId: input.mapId,
      mapPackageId: input.mapPackageId,
      mapPackageVersion: input.mapPackageVersion,
      selectedMapVersion: input.selectedMapVersion,
      activationId: input.activationId,
      activationSnapshotRef: input.activationSnapshotRef,
      stepId: input.stepId,
      capabilityCallId,
      sourceRef: resolveSourceRef(input.payloadRefs, inputRef),
      inputRef,
      payloadRefs,
      summary: `Request AI prompt ${input.promptContractId}`,
      tags: ["ai", input.promptContractId],
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      createdAt,
      expiresAt,
    }),
    envelopeKind: "ai_request" as const,
    requestId: capabilityCallId,
    from: "orchestration" as const,
    to: "ai" as const,
    taskType: input.promptContractId,
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptContractVersion,
    outputSchemaRef: input.outputSchemaRef,
    aiInputRefs: input.aiInputRefs,
    modelPolicyRef: null,
    providerPolicyRef: input.providerPolicyRef,
  };
}

export function buildAiDispatchDocument(input: SendAiInput) {
  return {
    documentType: "orchestration.ai_dispatch" as const,
    documentRef: `${input.missionId}:${input.stepId}:ai-input`,
    summary: `Request AI prompt ${input.promptContractId}`,
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: [],
  };
}

export function buildCommanderReviewEnvelope(input: SendReviewInput, envelopeId: string, createdAt: string, expiresAt: string) {
  const inputRef = `${input.missionId}:${input.stepId}:review-input`;
  const capabilityCallId = buildCapabilityCallId(input, "commander-review");
  const payloadRefs = collectPayloadRefs(input.payloadRefs, inputRef);
  return {
    ...buildSharedEnvelopeBase({
      channelId: "orchestration-to-commander",
      envelopeId,
      missionId: input.missionId,
      runId: input.runId,
      sessionId: input.sessionId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId,
      mapId: input.mapId,
      mapPackageId: input.mapPackageId,
      mapPackageVersion: input.mapPackageVersion,
      selectedMapVersion: input.selectedMapVersion,
      activationId: input.activationId,
      activationSnapshotRef: input.activationSnapshotRef,
      stepId: input.stepId,
      capabilityCallId,
      sourceRef: resolveSourceRef(input.payloadRefs, inputRef),
      inputRef,
      payloadRefs,
      summary: input.reason,
      tags: ["review", input.stepId],
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      createdAt,
      expiresAt,
    }),
    envelopeKind: "human_command_result" as const,
    resultId: capabilityCallId,
    from: "orchestration" as const,
    to: "commander-console" as const,
    correlationEnvelopeId: envelopeId,
    correlationCapabilityCallId: capabilityCallId,
    correlationInputRef: inputRef,
    status: "review_required" as const,
    outputRef: null,
    diagnosticPayloadRef: inputRef,
    proofRef: `${envelopeId}:proof`,
    failureReason: null,
    reviewRequiredReason: input.reason,
  };
}

export function buildCommanderReviewDocument(input: SendReviewInput) {
  return {
    documentType: "orchestration.review_dispatch" as const,
    documentRef: `${input.missionId}:${input.stepId}:review-input`,
    summary: input.reason,
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: [],
  };
}