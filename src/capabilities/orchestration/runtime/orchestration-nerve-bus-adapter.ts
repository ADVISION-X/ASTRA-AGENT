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
type AiTransportResponseEnvelope = Awaited<ReturnType<OrchestrationNerveBusTransportSurface["requestAi"]>>["responseEnvelope"];

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

const normalizeAbilityDispatchStatus = (input: {
  status: "success" | "failed" | "review_required";
  targetAbilityGroupId: SendAbilityInput["targetAbilityGroupId"];
}): "success" | "failed" | "review_required" =>
  input.targetAbilityGroupId === "screenshot"
    ? input.status
    : input.status === "success"
      ? "success"
      : "failed";

const normalizeAiDispatchStatus = (status: "success" | "failed" | "review_required"): "success" | "failed" =>
  status === "success" ? "success" : "failed";

const buildAiBranchFieldValues = (responseEnvelope: AiTransportResponseEnvelope) => ({
  decision: responseEnvelope.decision ?? null,
  routeLabel: responseEnvelope.routeLabel ?? null,
  nonExecutableSummary: responseEnvelope.nonExecutableSummary ?? null,
  confidence: responseEnvelope.confidence ?? null,
  implementationStatus: responseEnvelope.implementationStatus ?? null,
  runtimeCallId: responseEnvelope.runtimeCallId ?? null,
  rawOutputRef: responseEnvelope.rawOutputRef ?? null,
  rawOutputHash: responseEnvelope.rawOutputHash ?? null,
  diagnosticPayloadRef: responseEnvelope.diagnosticPayloadRef ?? null,
  schemaIssueCount: responseEnvelope.schemaIssueCount ?? null,
  schemaDecision: responseEnvelope.schemaDecision ?? null,
  schemaValidationStatus: responseEnvelope.schemaValidationStatus ?? null,
  qualityDecision: responseEnvelope.qualityDecision ?? null,
  qualityDecisionReason: responseEnvelope.qualityDecisionReason ?? null,
  outputBoundaryDecision: responseEnvelope.outputBoundaryDecision ?? null,
  minimumConfidence: responseEnvelope.minimumConfidence ?? null,
  dataQualityFlags: responseEnvelope.dataQualityFlags.join(",") || null,
  parsedDecision: responseEnvelope.parsedDecision ?? null,
});

const buildAiPayloadRefs = (input: SendAiInput, responseEnvelope: AiTransportResponseEnvelope) => ({
  ...input.payloadRefs,
  aiResultRef: responseEnvelope.outputRef ?? responseEnvelope.diagnosticPayloadRef ?? null,
  sourceAiResultRef: responseEnvelope.outputRef ?? responseEnvelope.diagnosticPayloadRef ?? null,
});

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
      status: normalizeAbilityDispatchStatus({
        status: transport.resultEnvelope.status,
        targetAbilityGroupId: input.targetAbilityGroupId,
      }),
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
      status: normalizeAiDispatchStatus(transport.responseEnvelope.status),
      envelopeId: transport.requestEnvelope.envelopeId,
      resultRef: transport.responseEnvelope.responseId ?? `${envelopeId}:result`,
      decision: transport.responseEnvelope.decision ?? null,
      branchFieldValues: buildAiBranchFieldValues(transport.responseEnvelope),
      failureReason: transport.responseEnvelope.failureReason ?? transport.responseEnvelope.reviewRequiredReason ?? null,
      payloadRefs: buildAiPayloadRefs(input, transport.responseEnvelope),
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
