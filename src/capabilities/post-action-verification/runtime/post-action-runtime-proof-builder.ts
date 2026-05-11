import { createHash } from "node:crypto";

import type { ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityResult } from "../contract.js";

type PostActionRuntimeProofInput = {
  request: ParsedPostActionVerificationAbilityInput | null;
  status: PostActionVerificationAbilityResult["status"];
  failureReason: PostActionVerificationAbilityResult["failureReason"];
  reviewRequiredReason: string | null;
  observationRefs: string[];
  evidenceRefs: string[];
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  debugLogRef: string;
  structuredRuntimeEventRef: string | null;
  receivedShapeHash: string | null;
  processingMode: "observation_packaging" | "invalid_input_failure";
  observationFingerprint: string | null;
  dataQualityFlags: string[];
  startedAt: { isoTimestamp: string; monotonicMs: number };
  endedAt: { isoTimestamp: string; monotonicMs: number };
};

const stringifyForHash = (value: unknown) => JSON.stringify(value, null, 0);

export const buildPostActionHash = (value: unknown) => createHash("sha256").update(stringifyForHash(value)).digest("hex");

export const buildPostActionDebugRefs = (inputRef: string) => ({
  debugLogRef: `${inputRef}:debug-log`,
  diagnosticPayloadRef: `${inputRef}:diagnostic-payload`,
  structuredRuntimeEventRef: `${inputRef}:runtime-event`,
});

export const buildPostActionObservationFingerprint = (request: ParsedPostActionVerificationAbilityInput, observationRefs: readonly string[]) => buildPostActionHash({
  childCapabilityId: request.childCapabilityId,
  observationRefs,
  actionProofRef: request.actionProof.actionProofRef,
  sourceActionType: request.sourceActionType,
});

function buildPostActionRuntimeIdentity(request: ParsedPostActionVerificationAbilityInput | null) {
  return {
    proofId: `${request?.inputRef ?? "invalid"}:runtime-proof`,
    missionId: request?.missionId ?? null,
    runId: request?.runId ?? "invalid:post-action-run",
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
    abilityGroupId: "post-action-verification" as const,
    childCapabilityId: request?.childCapabilityId ?? null,
    inputRef: request?.inputRef ?? "invalid:post-action-input",
  };
}

function buildPostActionRuntimeSources(request: ParsedPostActionVerificationAbilityInput | null, input: PostActionRuntimeProofInput) {
  return {
    actionProofRef: request?.actionProof.actionProofRef ?? null,
    actionLogRef: request?.actionProof.actionLogRef ?? null,
    sourceActionRuntimeProofRef: request?.actionProof.sourceRuntimeProofRef ?? null,
    sourceActionResultRef: request?.actionProof.sourceActionResultRef ?? null,
    sourceActionOutputRef: request?.actionProof.sourceActionOutputRef ?? null,
    sourceActionAbilityGroupId: request?.sourceAbilityGroupId ?? null,
    sourceActionChildCapabilityId: request?.sourceChildCapabilityId ?? null,
    actionType: request?.sourceActionType ?? null,
    actionStatus: request?.actionProof.actionStatus ?? null,
    expectedOutcomeType: request?.expectedOutcome.outcomeType ?? null,
    beforeEvidenceRefs: request?.beforeAfterEvidence.beforeEvidence ? [request.beforeAfterEvidence.beforeEvidence.evidenceRef] : [],
    afterEvidenceRefs: request?.beforeAfterEvidence.afterEvidence ? [request.beforeAfterEvidence.afterEvidence.evidenceRef] : [],
    observationRefs: input.observationRefs,
    evidenceSourceRefs: input.evidenceRefs,
    outputRef: input.outputRef,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    debugLogRef: input.debugLogRef,
    structuredRuntimeEventRef: input.structuredRuntimeEventRef,
  };
}

function buildPostActionRuntimeHashes(request: ParsedPostActionVerificationAbilityInput | null, input: PostActionRuntimeProofInput) {
  return {
    inputPayloadHash: buildPostActionHash(request ?? { invalid: true }),
    actionProofHash: request ? buildPostActionHash(request.actionProof) : null,
    expectedOutcomeHash: request ? buildPostActionHash(request.expectedOutcome) : null,
    beforeEvidenceHash: request ? buildPostActionHash(request.beforeAfterEvidence.beforeEvidence) : null,
    afterEvidenceHash: request ? buildPostActionHash(request.beforeAfterEvidence.afterEvidence) : null,
    observationSetHash: request ? buildPostActionHash(request.observationSet) : buildPostActionHash([]),
    observationFingerprint: input.observationFingerprint,
    receivedShapeHash: input.receivedShapeHash,
  };
}

function buildPostActionRuntimeOutcome(input: PostActionRuntimeProofInput) {
  return {
    startedAt: input.startedAt.isoTimestamp,
    endedAt: input.endedAt.isoTimestamp,
    durationMs: Math.max(0, Math.round(input.endedAt.monotonicMs - input.startedAt.monotonicMs)),
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    processingMode: input.processingMode,
    dataQualityFlags: input.dataQualityFlags,
    clock: {
      portKind: "post-action-verification-clock" as const,
      startedMonotonicMs: input.startedAt.monotonicMs,
      endedMonotonicMs: input.endedAt.monotonicMs,
    },
  };
}

export function buildPostActionRuntimeProof(input: PostActionRuntimeProofInput) {
  const request = input.request;
  return {
    ...buildPostActionRuntimeIdentity(request),
    ...buildPostActionRuntimeSources(request, input),
    ...buildPostActionRuntimeHashes(request, input),
    ...buildPostActionRuntimeOutcome(input),
  };
}