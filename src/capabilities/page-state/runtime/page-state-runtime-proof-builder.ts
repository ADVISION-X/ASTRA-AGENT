import { createHash } from "node:crypto";

import type { PageStateAbilityInput, PageStateAbilityResult, PageStateFailureReason } from "../schema.js";

type PageStateRuntimeProofInput = {
  request: PageStateAbilityInput | null;
  status: PageStateAbilityResult["status"];
  failureReason: PageStateFailureReason | null;
  reviewRequiredReason: string | null;
  observationRefs: string[];
  sourceEvidenceRefs: string[];
  clockStartedAt: { isoTimestamp: string; epochMs: number };
  clockEndedAt: { isoTimestamp: string; epochMs: number };
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  debugLogRef: string;
  structuredRuntimeEventRef: string | null;
  receivedShapeHash: string | null;
  processingMode: "observation_packaging" | "invalid_input_failure";
  observationFingerprint: string | null;
};

const stringifyForHash = (value: unknown) => JSON.stringify(value, null, 0);

export const buildPageStateHash = (value: unknown) => createHash("sha256").update(stringifyForHash(value)).digest("hex");

export const buildPageStateDebugRefs = (inputRef: string) => ({
  debugLogRef: `${inputRef}:debug-log`,
  diagnosticPayloadRef: `${inputRef}:diagnostic-payload`,
  structuredRuntimeEventRef: `${inputRef}:runtime-event`,
});

export const buildPageStateObservationFingerprint = (request: PageStateAbilityInput, observationRefs: readonly string[]) => buildPageStateHash({
  childCapabilityId: request.childCapabilityId,
  currentUrl: request.snapshot.currentUrl,
  observationRefs,
  sourceEvidenceRefs: request.sourceEvidenceRefs,
});

function buildPageStateRuntimeIdentity(request: PageStateAbilityInput | null) {
  return {
    proofId: `${request?.inputRef ?? "invalid"}:runtime-proof`,
    runId: request?.runId ?? null,
    missionId: request?.missionId ?? null,
    sessionId: request?.sessionId ?? null,
    roundId: request?.roundId ?? null,
    videoVisitId: request?.videoVisitId ?? null,
    stepId: request?.stepId ?? null,
    bindingPackageId: request?.bindingPackageId ?? null,
    bindingPackageVersion: request?.bindingPackageVersion ?? null,
    selectedBindingId: request?.selectedBindingId ?? null,
    bindingVersion: request?.bindingVersion ?? null,
    bindingSnapshotRef: request?.bindingSnapshotRef ?? null,
    capabilityCallId: request?.capabilityCallId ?? null,
    nerveBusEnvelopeId: request?.nerveBusEnvelopeId ?? null,
    abilityGroupId: "page-state" as const,
    childCapabilityId: request?.childCapabilityId ?? null,
    inputRef: request?.inputRef ?? "invalid:page-state-input",
  };
}

function buildPageStateRuntimeSources(request: PageStateAbilityInput | null, input: PageStateRuntimeProofInput) {
  return {
    outputRef: input.outputRef,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    debugLogRef: input.debugLogRef,
    structuredRuntimeEventRef: input.structuredRuntimeEventRef,
    snapshotId: request?.snapshot.snapshotId ?? null,
    snapshotProofRef: request?.snapshot.sourceProofRef ?? null,
    openHandoffProofRef: request?.openHandoff.openProofRef ?? null,
    browserSessionRef: request?.openHandoff.browserSessionRef ?? null,
    platformProfileId: request?.openHandoff.platformProfileId ?? null,
    sourceAbilityGroupId: request?.snapshot.sourceAbilityGroupId ?? null,
    sourceChildCapabilityId: request?.snapshot.sourceChildCapabilityId ?? null,
    observationRefs: input.observationRefs,
    sourceEvidenceRefs: input.sourceEvidenceRefs,
  };
}

function buildPageStateRuntimeHashes(request: PageStateAbilityInput | null, input: PageStateRuntimeProofInput) {
  return {
    inputPayloadHash: buildPageStateHash(request ?? { invalid: true }),
    snapshotHash: request ? buildPageStateHash(request.snapshot) : null,
    observationHash: request ? buildPageStateHash(request.observations) : null,
    observationFingerprint: input.observationFingerprint,
    currentUrl: request?.snapshot.currentUrl ?? null,
    currentTitle: request?.snapshot.currentTitle ?? null,
    receivedShapeHash: input.receivedShapeHash,
  };
}

function buildPageStateRuntimeOutcome(input: PageStateRuntimeProofInput) {
  return {
    processingMode: input.processingMode,
    startedAt: input.clockStartedAt.isoTimestamp,
    endedAt: input.clockEndedAt.isoTimestamp,
    durationMs: Math.max(0, input.clockEndedAt.epochMs - input.clockStartedAt.epochMs),
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.status === "success" ? [] : ["insufficient_signal"],
  };
}

export function buildPageStateRuntimeProof(input: PageStateRuntimeProofInput) {
  const request = input.request;
  return {
    ...buildPageStateRuntimeIdentity(request),
    ...buildPageStateRuntimeSources(request, input),
    ...buildPageStateRuntimeHashes(request, input),
    ...buildPageStateRuntimeOutcome(input),
  };
}