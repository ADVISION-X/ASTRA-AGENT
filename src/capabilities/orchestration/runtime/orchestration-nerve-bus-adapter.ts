import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { NerveBusAbilityGroup } from "../../nerve-bus/index.js";
import type { OrchestrationNerveBusPort } from "../ports/orchestration-nerve-bus-port.js";
import {
  buildAbilityDispatchDocument,
  buildAbilityDispatchEnvelope,
  buildAiDispatchDocument,
  buildAiDispatchEnvelope,
} from "./orchestration-nerve-bus-envelope-builders.js";
import { resolveAbilityResultProofSummary } from "./ability-result-proof-summary-registry.js";

export type OrchestrationNerveBusTransportSurface = Pick<NerveBusAbilityGroup, "dispatchAbilityCommand" | "requestAi">;

type SendAbilityInput = Parameters<OrchestrationNerveBusPort["sendCommandToAbility"]>[0];
type SendAiInput = Parameters<OrchestrationNerveBusPort["sendRequestToAi"]>[0];

type EnvelopeClock = { now: () => { isoTimestamp: string; monotonicMs: number } };

const PROOF_SUMMARY_REF_KEYS = [
  "screenshotEvidenceId",
  "artifactRef",
  "artifactStorageRef",
  "outputHash",
  "artifactHash",
  "byteSize",
  "width",
  "height",
  "coordinateSpace",
  "runtimeProofRef",
  "promptInputRef",
  "aiInputArtifactRef",
  "aiInputStorageRef",
  "sourceScreenshotEvidenceId",
  "sourceStorageRef",
  "preparedImageHash",
  "preparedImageWidth",
  "preparedImageHeight",
] as const;

function buildProofBranchFieldValues(outputRef: string | null): Record<string, string | number | boolean | null> {
  const summary = resolveAbilityResultProofSummary(outputRef);
  if (!summary) {
    return {};
  }

  return Object.fromEntries(
    PROOF_SUMMARY_REF_KEYS
      .map((key) => [key, summary[key] ?? null] as const)
      .filter(([, value]) => value !== null),
  );
}

const normalizeDispatchStatus = (status: "success" | "failed" | "review_required"): "success" | "failed" =>
  status === "success" ? "success" : "failed";

function createAbilityCommandDispatcher(nerveBus: OrchestrationNerveBusTransportSurface, clock: EnvelopeClock) {
  return async (input: SendAbilityInput) => {
    const envelopeId = randomUUID();
    const createdAt = clock.now().isoTimestamp;
    const expiresAt = new Date(Date.now() + input.timeoutMs).toISOString();
    const transport = await nerveBus.dispatchAbilityCommand({
      envelope: buildAbilityDispatchEnvelope(input, envelopeId, createdAt, expiresAt),
      inputPayload: buildAbilityDispatchDocument(input),
    });
    const outputRef = transport.resultEnvelope.outputRef ?? null;
    return {
      status: normalizeDispatchStatus(transport.resultEnvelope.status),
      envelopeId: transport.commandEnvelope.envelopeId,
      resultRef: transport.resultEnvelope.resultId ?? `${envelopeId}:result`,
      decision: null,
      branchFieldValues: buildProofBranchFieldValues(outputRef),
      failureReason: transport.resultEnvelope.failureReason ?? transport.resultEnvelope.reviewRequiredReason ?? null,
      payloadRefs: {
        ...input.payloadRefs,
        abilityResultRef: outputRef,
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
      signal: input.signal,
    });
    return {
      status: normalizeDispatchStatus(transport.responseEnvelope.status),
      envelopeId: transport.requestEnvelope.envelopeId,
      resultRef: transport.responseEnvelope.responseId ?? `${envelopeId}:result`,
      decision: transport.responseEnvelope.decision ?? null,
      branchFieldValues: {
        decision: transport.responseEnvelope.decision ?? null,
        routeLabel: transport.responseEnvelope.routeLabel ?? null,
        nonExecutableSummary: transport.responseEnvelope.nonExecutableSummary ?? null,
        confidence: transport.responseEnvelope.confidence ?? null,
        implementationStatus: transport.responseEnvelope.implementationStatus ?? null,
        runtimeCallId: transport.responseEnvelope.runtimeCallId ?? null,
        rawOutputRef: transport.responseEnvelope.rawOutputRef ?? null,
        rawOutputHash: transport.responseEnvelope.rawOutputHash ?? null,
        diagnosticPayloadRef: transport.responseEnvelope.diagnosticPayloadRef ?? null,
        schemaIssueCount: transport.responseEnvelope.schemaIssueCount ?? null,
        schemaDecision: transport.responseEnvelope.schemaDecision ?? null,
        schemaValidationStatus: transport.responseEnvelope.schemaValidationStatus ?? null,
        qualityDecision: transport.responseEnvelope.qualityDecision ?? null,
        qualityDecisionReason: transport.responseEnvelope.qualityDecisionReason ?? null,
        outputBoundaryDecision: transport.responseEnvelope.outputBoundaryDecision ?? null,
        minimumConfidence: transport.responseEnvelope.minimumConfidence ?? null,
        dataQualityFlags: transport.responseEnvelope.dataQualityFlags.join(",") || null,
        parsedDecision: transport.responseEnvelope.parsedDecision ?? null,
      },
      failureReason: transport.responseEnvelope.failureReason ?? transport.responseEnvelope.reviewRequiredReason ?? null,
      payloadRefs: {
        ...input.payloadRefs,
        aiResultRef: transport.responseEnvelope.outputRef ?? transport.responseEnvelope.diagnosticPayloadRef ?? null,
        sourceAiResultRef: transport.responseEnvelope.outputRef ?? transport.responseEnvelope.diagnosticPayloadRef ?? null,
      },
    };
  };
}

export function createOrchestrationNerveBusAdapter(nerveBus: OrchestrationNerveBusTransportSurface): OrchestrationNerveBusPort {
  const clock = { now: () => ({ isoTimestamp: new Date().toISOString(), monotonicMs: performance.now() }) };

  return {
    sendCommandToAbility: createAbilityCommandDispatcher(nerveBus, clock),
    sendRequestToAi: createAiRequestDispatcher(nerveBus, clock),
  };
}
