import type { ZodIssue } from "zod";

import { PostActionVerificationAbilityResultSchema } from "../schema.js";
import type {
  ParsedPostActionVerificationAbilityInput,
  PostActionVerificationAbilityResult,
} from "../contract.js";
import type { PostActionChildObservation, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
import {
  buildPostActionDebugRefs,
  buildPostActionHash,
  buildPostActionObservationFingerprint,
  buildPostActionRuntimeProof,
} from "./post-action-runtime-proof-builder.js";

function buildPostActionRequestFields(request: ParsedPostActionVerificationAbilityInput) {
  return {
    childCapabilityId: request.childCapabilityId,
    missionId: request.missionId,
    runId: request.runId,
    sessionId: request.sessionId,
    roundId: request.roundId,
    videoVisitId: request.videoVisitId,
    stepId: request.stepId,
    mapPackageId: request.mapPackageId,
    mapPackageVersion: request.mapPackageVersion,
    selectedMapId: request.selectedMapId,
    selectedMapVersion: request.selectedMapVersion,
    activationSnapshotRef: request.activationSnapshotRef,
    capabilityCallId: request.capabilityCallId,
    nerveBusEnvelopeId: request.nerveBusEnvelopeId,
    actionProofRef: request.actionProof.actionProofRef,
    expectedOutcome: request.expectedOutcome,
  };
}

function buildEmptyPostActionRequestFields() {
  return {
    childCapabilityId: null,
    missionId: null,
    runId: null,
    sessionId: null,
    roundId: null,
    videoVisitId: null,
    stepId: null,
    mapPackageId: null,
    mapPackageVersion: null,
    selectedMapId: null,
    selectedMapVersion: null,
    activationSnapshotRef: null,
    capabilityCallId: null,
    nerveBusEnvelopeId: null,
    actionProofRef: null,
    expectedOutcome: null,
  };
}

function buildFailureArtifacts(request: ParsedPostActionVerificationAbilityInput, context: PostActionVerificationRuntimeContext) {
  return {
    startedAt: context.clock.now(),
    endedAt: context.clock.now(),
    refs: buildPostActionDebugRefs(request.inputRef),
    observationRefs: request.observationSet.observations.map((observation) => observation.ref),
    evidenceRefs: [
      request.beforeAfterEvidence.beforeEvidence?.evidenceRef ?? null,
      request.beforeAfterEvidence.afterEvidence?.evidenceRef ?? null,
      request.actionProof.actionProofRef,
    ].filter((value): value is string => Boolean(value)),
  };
}

export function createPostActionFailureResult(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  status: "failed" | "review_required";
  failureReason: PostActionVerificationAbilityResult["failureReason"];
  statusMessage: string;
  reviewRequiredReason?: string | null;
}): PostActionVerificationAbilityResult {
  const artifacts = buildFailureArtifacts(input.request, input.context);
  const runtimeProof = buildPostActionRuntimeProof({
    request: input.request,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    observationRefs: artifacts.observationRefs,
    evidenceRefs: artifacts.evidenceRefs,
    outputRef: null,
    diagnosticPayloadRef: artifacts.refs.diagnosticPayloadRef,
    debugLogRef: artifacts.refs.debugLogRef,
    structuredRuntimeEventRef: artifacts.refs.structuredRuntimeEventRef,
    receivedShapeHash: null,
    processingMode: "observation_packaging",
    observationFingerprint: buildPostActionObservationFingerprint(input.request, artifacts.observationRefs),
    startedAt: artifacts.startedAt,
    endedAt: artifacts.endedAt,
  });

  return PostActionVerificationAbilityResultSchema.parse({
    ...buildPostActionRequestFields(input.request),
    status: input.status,
    abilityGroupId: "post-action-verification",
    output: null,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    statusMessage: input.statusMessage,
    debugLogRef: artifacts.refs.debugLogRef,
    structuredRuntimeEventRef: artifacts.refs.structuredRuntimeEventRef,
    diagnosticPayloadRef: artifacts.refs.diagnosticPayloadRef,
    runtimeProof,
    dataQualityFlags: runtimeProof.dataQualityFlags,
  });
}

function buildInvalidPostActionShapeHash(rawInput: unknown, issues: readonly ZodIssue[]) {
  return buildPostActionHash({
    rawInput,
    issues: issues.map((issue) => ({ path: issue.path, message: issue.message })),
  });
}

export function createInvalidPostActionInputResult(input: {
  rawInput: unknown;
  context: PostActionVerificationRuntimeContext;
  issues: readonly ZodIssue[];
}): PostActionVerificationAbilityResult {
  const startedAt = input.context.clock.now();
  const endedAt = input.context.clock.now();
  const inputRef = `invalid:post-action:${buildPostActionHash(input.rawInput).slice(0, 12)}`;
  const refs = buildPostActionDebugRefs(inputRef);
  const receivedShapeHash = buildInvalidPostActionShapeHash(input.rawInput, input.issues);
  const runtimeProof = buildPostActionRuntimeProof({
    request: null,
    status: "failed",
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    observationRefs: [],
    evidenceRefs: [],
    outputRef: null,
    diagnosticPayloadRef: refs.diagnosticPayloadRef,
    debugLogRef: refs.debugLogRef,
    structuredRuntimeEventRef: refs.structuredRuntimeEventRef,
    receivedShapeHash,
    processingMode: "invalid_input_failure",
    observationFingerprint: null,
    startedAt,
    endedAt,
  });

  return PostActionVerificationAbilityResultSchema.parse({
    ...buildEmptyPostActionRequestFields(),
    status: "failed",
    abilityGroupId: "post-action-verification",
    output: null,
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    statusMessage: "Post Action Verification rejected invalid input schema.",
    debugLogRef: refs.debugLogRef,
    structuredRuntimeEventRef: refs.structuredRuntimeEventRef,
    diagnosticPayloadRef: refs.diagnosticPayloadRef,
    runtimeProof,
    dataQualityFlags: ["output_boundary_violation"],
  });
}

function buildSuccessfulPostActionOutput(input: {
  request: ParsedPostActionVerificationAbilityInput;
  childObservation: PostActionChildObservation;
  observationFingerprint: string;
}) {
  return {
    packageLabel: input.childObservation.packageLabel,
    observationSummary: input.childObservation.observationSummary,
    evidenceRefs: input.childObservation.supportingEvidenceRefs,
    observationRefs: input.childObservation.supportingObservationRefs,
    actionResultObservationRef: `${input.request.inputRef}:action-observation`,
    observationFingerprint: input.observationFingerprint,
    supportingSourceProofRefs: input.childObservation.supportingSourceProofRefs,
  };
}

export function createSuccessfulPostActionResult(input: {
  request: ParsedPostActionVerificationAbilityInput;
  childObservation: PostActionChildObservation;
  startedAt: { isoTimestamp: string; monotonicMs: number };
  endedAt: { isoTimestamp: string; monotonicMs: number };
}): PostActionVerificationAbilityResult {
  const refs = buildPostActionDebugRefs(input.request.inputRef);
  const observationFingerprint = buildPostActionObservationFingerprint(input.request, input.childObservation.supportingObservationRefs);
  const runtimeProof = buildPostActionRuntimeProof({
    request: input.request,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    observationRefs: input.childObservation.supportingObservationRefs,
    evidenceRefs: input.childObservation.supportingEvidenceRefs,
    outputRef: `${input.request.inputRef}:output`,
    diagnosticPayloadRef: null,
    debugLogRef: refs.debugLogRef,
    structuredRuntimeEventRef: refs.structuredRuntimeEventRef,
    receivedShapeHash: null,
    processingMode: "observation_packaging",
    observationFingerprint,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });

  return PostActionVerificationAbilityResultSchema.parse({
    ...buildPostActionRequestFields(input.request),
    status: "success",
    abilityGroupId: "post-action-verification",
    output: buildSuccessfulPostActionOutput({
      request: input.request,
      childObservation: input.childObservation,
      observationFingerprint,
    }),
    failureReason: null,
    reviewRequiredReason: null,
    statusMessage: input.childObservation.statusMessage,
    debugLogRef: refs.debugLogRef,
    structuredRuntimeEventRef: refs.structuredRuntimeEventRef,
    diagnosticPayloadRef: null,
    runtimeProof,
    dataQualityFlags: input.childObservation.dataQualityFlags,
  });
}