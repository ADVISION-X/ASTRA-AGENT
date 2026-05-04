import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { NerveBusAbilityGroup } from "../../nerve-bus/index.js";
import type { OrchestrationNerveBusPort } from "../ports/orchestration-nerve-bus-port.js";
import {
  buildAbilityDispatchDocument,
  buildAbilityDispatchEnvelope,
  buildAiDispatchDocument,
  buildAiDispatchEnvelope,
  buildCommanderReviewDocument,
  buildCommanderReviewEnvelope,
} from "./orchestration-nerve-bus-envelope-builders.js";

export type OrchestrationNerveBusTransportSurface = Pick<NerveBusAbilityGroup, "dispatchAbilityCommand" | "dispatchCommanderMessage" | "requestAi">;

type SendAbilityInput = Parameters<OrchestrationNerveBusPort["sendCommandToAbility"]>[0];
type SendAiInput = Parameters<OrchestrationNerveBusPort["sendRequestToAi"]>[0];
type SendReviewInput = Parameters<OrchestrationNerveBusPort["sendReviewRequestToCommander"]>[0];

type EnvelopeClock = { now: () => { isoTimestamp: string; monotonicMs: number } };

function createAbilityCommandDispatcher(nerveBus: OrchestrationNerveBusTransportSurface, clock: EnvelopeClock) {
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
      branchFieldValues: {},
      failureReason: transport.resultEnvelope.failureReason ?? transport.resultEnvelope.reviewRequiredReason ?? null,
      payloadRefs: {
        ...input.payloadRefs,
        abilityResultRef: transport.resultEnvelope.outputRef ?? null,
      },
    };
  };
}

function createAiRequestDispatcher(nerveBus: OrchestrationNerveBusTransportSurface, clock: EnvelopeClock) {
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
      branchFieldValues: {
        decision: transport.responseEnvelope.decision ?? null,
        confidence: transport.responseEnvelope.confidence ?? null,
      },
      failureReason: transport.responseEnvelope.failureReason ?? transport.responseEnvelope.reviewRequiredReason ?? null,
      payloadRefs: {
        ...input.payloadRefs,
        aiResultRef: transport.responseEnvelope.outputRef ?? null,
      },
    };
  };
}

function createCommanderReviewDispatcher(nerveBus: OrchestrationNerveBusTransportSurface, clock: EnvelopeClock) {
  return async (input: SendReviewInput) => {
    const envelopeId = randomUUID();
    const createdAt = clock.now().isoTimestamp;
    const expiresAt = new Date(Date.now() + 30_000).toISOString();
    const transport = await nerveBus.dispatchCommanderMessage({
      envelope: buildCommanderReviewEnvelope(input, envelopeId, createdAt, expiresAt),
      inputPayload: buildCommanderReviewDocument(input),
    });
    return {
      status: "review_required" as const,
      reviewDispatchRef: transport.transportedEnvelope.envelopeId,
      failureReason: transport.reviewRequiredReason ?? transport.failureReason ?? input.reason,
      payloadRefs: {
        ...input.payloadRefs,
        reviewReasonRef: transport.transportedEnvelope.diagnosticPayloadRef,
      },
    };
  };
}

export function createOrchestrationNerveBusAdapter(nerveBus: OrchestrationNerveBusTransportSurface): OrchestrationNerveBusPort {
  const clock = { now: () => ({ isoTimestamp: new Date().toISOString(), monotonicMs: performance.now() }) };

  return {
    sendCommandToAbility: createAbilityCommandDispatcher(nerveBus, clock),
    sendRequestToAi: createAiRequestDispatcher(nerveBus, clock),
    sendReviewRequestToCommander: createCommanderReviewDispatcher(nerveBus, clock),
  };
}