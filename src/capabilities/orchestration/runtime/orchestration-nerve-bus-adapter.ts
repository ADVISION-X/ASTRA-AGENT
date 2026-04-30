import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { NerveBusAbilityGroup } from "../../nerve-bus/index.js";
import type { OrchestrationNerveBusPort } from "../ports/orchestration-nerve-bus-port.js";

type SendAbilityInput = Parameters<OrchestrationNerveBusPort["sendCommandToAbility"]>[0];
type SendAiInput = Parameters<OrchestrationNerveBusPort["sendRequestToAi"]>[0];
type SendReviewInput = Parameters<OrchestrationNerveBusPort["sendReviewRequestToCommander"]>[0];

function buildAbilityDispatchEnvelope(input: SendAbilityInput, envelopeId: string, createdAt: string, expiresAt: string) {
  return {
    abilityGroupId: "nerve-bus" as const,
    channelId: "orchestration-to-ability" as const,
    envelopeId,
    transportId: randomUUID(),
    traceId: `${input.missionId}:${input.mapId}`,
    spanId: `${input.stepId}:ability`,
    attemptId: `${envelopeId}:attempt:1`,
    missionId: input.missionId,
    mapId: input.mapId,
    stepId: input.stepId,
    idempotencyKey: input.idempotencyKey,
    sequenceNo: input.sequenceNo,
    inputRef: `${input.missionId}:${input.stepId}:input`,
    payloadRef: [`${input.missionId}:${input.stepId}:payload`],
    payload: {
      summary: `Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`,
      entityRefs: [],
      evidenceRefs: [],
      tags: [input.targetAbilityGroupId, input.childCapabilityId],
      attributes: [],
    },
    createdAt,
    expiresAt,
    envelopeKind: "ability_command" as const,
    commandId: `${input.missionId}:${input.stepId}:cmd`,
    from: "orchestration" as const,
    to: input.targetAbilityGroupId,
    commandName: input.childCapabilityId,
  };
}

function buildAbilityDispatchDocument(input: SendAbilityInput) {
  return {
    documentType: "orchestration.ability_dispatch" as const,
    documentRef: `${input.missionId}:${input.stepId}:input`,
    summary: `Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`,
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: [],
  };
}

function buildAiDispatchEnvelope(input: SendAiInput, envelopeId: string, createdAt: string, expiresAt: string) {
  return {
    abilityGroupId: "nerve-bus" as const,
    channelId: "orchestration-to-ai" as const,
    envelopeId,
    transportId: randomUUID(),
    traceId: `${input.missionId}:${input.mapId}`,
    spanId: `${input.stepId}:ai`,
    attemptId: `${envelopeId}:attempt:1`,
    missionId: input.missionId,
    mapId: input.mapId,
    stepId: input.stepId,
    idempotencyKey: input.idempotencyKey,
    sequenceNo: input.sequenceNo,
    inputRef: `${input.missionId}:${input.stepId}:ai-input`,
    payloadRef: [`${input.missionId}:${input.stepId}:ai-payload`],
    payload: {
      summary: `Request AI prompt ${input.promptContractId}`,
      entityRefs: [],
      evidenceRefs: [],
      tags: ["ai", input.promptContractId],
      attributes: [],
    },
    createdAt,
    expiresAt,
    envelopeKind: "ai_request" as const,
    requestId: `${input.missionId}:${input.stepId}:ai`,
    from: "orchestration" as const,
    to: "ai" as const,
    taskType: input.promptContractId,
    promptRef: input.promptContractId,
  };
}

function buildAiDispatchDocument(input: SendAiInput) {
  return {
    documentType: "orchestration.ai_dispatch" as const,
    documentRef: `${input.missionId}:${input.stepId}:ai-input`,
    summary: `Request AI prompt ${input.promptContractId}`,
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: [],
  };
}

function createAbilityCommandDispatcher(nerveBus: NerveBusAbilityGroup, clock: { now: () => { isoTimestamp: string; monotonicMs: number } }) {
  return async (input: SendAbilityInput) => {
    const envelopeId = randomUUID();
    const createdAt = clock.now().isoTimestamp;
    const expiresAt = new Date(Date.now() + input.timeoutMs).toISOString();
    const transport = await nerveBus.dispatchAbilityCommand({
      envelope: buildAbilityDispatchEnvelope(input, envelopeId, createdAt, expiresAt),
      inputPayload: buildAbilityDispatchDocument(input),
    });
    return {
      status: transport.resultEnvelope.status,
      envelopeId: transport.commandEnvelope.envelopeId,
      resultRef: transport.resultEnvelope.resultId ?? `${envelopeId}:result`,
      decision: null,
      failureReason: transport.resultEnvelope.failureReason ?? transport.resultEnvelope.reviewRequiredReason ?? null,
      payloadRefs: {
        ...input.payloadRefs,
        abilityResultRef: transport.resultEnvelope.outputRef ?? null,
      },
    };
  };
}

function createAiRequestDispatcher(nerveBus: NerveBusAbilityGroup, clock: { now: () => { isoTimestamp: string; monotonicMs: number } }) {
  return async (input: SendAiInput) => {
    const envelopeId = randomUUID();
    const createdAt = clock.now().isoTimestamp;
    const expiresAt = new Date(Date.now() + input.timeoutMs).toISOString();
    const transport = await nerveBus.requestAi({
      envelope: buildAiDispatchEnvelope(input, envelopeId, createdAt, expiresAt),
      inputPayload: buildAiDispatchDocument(input),
    });
    return {
      status: transport.responseEnvelope.status,
      envelopeId: transport.requestEnvelope.envelopeId,
      resultRef: transport.responseEnvelope.responseId ?? `${envelopeId}:result`,
      decision: transport.responseEnvelope.decision ?? null,
      failureReason: transport.responseEnvelope.failureReason ?? transport.responseEnvelope.reviewRequiredReason ?? null,
      payloadRefs: {
        ...input.payloadRefs,
        aiResultRef: transport.responseEnvelope.outputRef ?? null,
      },
    };
  };
}

function createCommanderReviewDispatcher() {
  return async (input: SendReviewInput) => {
    const reviewDispatchRef = randomUUID();
    return {
      status: "review_required" as const,
      reviewDispatchRef,
      failureReason: input.reason,
      payloadRefs: {
        ...input.payloadRefs,
        reviewReasonRef: reviewDispatchRef,
      },
    };
  };
}

export function createOrchestrationNerveBusAdapter(nerveBus: NerveBusAbilityGroup): OrchestrationNerveBusPort {
  const clock = { now: () => ({ isoTimestamp: new Date().toISOString(), monotonicMs: performance.now() }) };

  return {
    sendCommandToAbility: createAbilityCommandDispatcher(nerveBus, clock),
    sendRequestToAi: createAiRequestDispatcher(nerveBus, clock),
    sendReviewRequestToCommander: createCommanderReviewDispatcher(),
  };
}