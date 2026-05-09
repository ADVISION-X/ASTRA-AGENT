import type { ZodIssue } from "zod";

import { PostActionVerificationAbilityResultSchema } from "../schema.js";
import type {
  ParsedPostActionVerificationAbilityInput,
  PostActionVerificationAbilityResult,
} from "../contract.js";
import type { PostActionChildObservation, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
import {
  buildSuccessfulResultPayload,
  buildSuccessfulRuntimeProof,
} from "./post-action-success-result.js";
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
    runId: "invalid:post-action-run",
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

function buildBeforeEvidenceRefs(request: ParsedPostActionVerificationAbilityInput | null): string[] {
  return request?.beforeAfterEvidence.beforeEvidence ? [request.beforeAfterEvidence.beforeEvidence.evidenceRef] : [];
}

function buildAfterEvidenceRefs(request: ParsedPostActionVerificationAbilityInput | null): string[] {
  return request?.beforeAfterEvidence.afterEvidence ? [request.beforeAfterEvidence.afterEvidence.evidenceRef] : [];
}

const parsePostActionResult = (value: unknown): PostActionVerificationAbilityResult =>
  PostActionVerificationAbilityResultSchema.parse(value);

const buildFailureRuntimeProof = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  status: "failed" | "review_required";
  failureReason: PostActionVerificationAbilityResult["failureReason"];
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
  artifacts: ReturnType<typeof buildFailureArtifacts>;
}) => buildPostActionRuntimeProof({
  request: input.request,
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  observationRefs: input.artifacts.observationRefs,
  evidenceRefs: input.artifacts.evidenceRefs,
  outputRef: null,
  diagnosticPayloadRef: input.artifacts.refs.diagnosticPayloadRef,
  debugLogRef: input.artifacts.refs.debugLogRef,
  structuredRuntimeEventRef: input.artifacts.refs.structuredRuntimeEventRef,
  receivedShapeHash: null,
  processingMode: "observation_packaging",
  observationFingerprint: buildPostActionObservationFingerprint(input.request, input.artifacts.observationRefs),
  dataQualityFlags: input.dataQualityFlags,
  startedAt: input.artifacts.startedAt,
  endedAt: input.artifacts.endedAt,
});

const buildFailureResultPayload = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  status: "failed" | "review_required";
  failureReason: PostActionVerificationAbilityResult["failureReason"];
  statusMessage: string;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
  artifacts: ReturnType<typeof buildFailureArtifacts>;
  runtimeProof: ReturnType<typeof buildFailureRuntimeProof>;
}) => ({
  ...buildPostActionRequestFields(input.request),
  status: input.status,
  abilityGroupId: "post-action-verification",
  postActionVerificationResultRef: null,
  sourceActionResultRef: input.request.actionProof.sourceActionResultRef,
  sourceActionRuntimeProofRef: input.request.actionProof.sourceRuntimeProofRef,
  sourceActionAbilityGroupId: input.request.sourceAbilityGroupId,
  sourceActionChildCapabilityId: input.request.sourceChildCapabilityId,
  beforeEvidenceRefs: buildBeforeEvidenceRefs(input.request),
  afterEvidenceRefs: buildAfterEvidenceRefs(input.request),
  observationRefs: input.artifacts.observationRefs,
  supportingSourceProofRefs: [],
  observationFingerprint: input.runtimeProof.observationFingerprint,
  packageStatus: input.status === "failed" ? "failed" : "review_required",
  output: null,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  statusMessage: input.statusMessage,
  debugLogRef: input.artifacts.refs.debugLogRef,
  structuredRuntimeEventRef: input.artifacts.refs.structuredRuntimeEventRef,
  diagnosticPayloadRef: input.artifacts.refs.diagnosticPayloadRef,
  runtimeProof: input.runtimeProof,
  dataQualityFlags: input.dataQualityFlags.length > 0 ? input.dataQualityFlags : input.runtimeProof.dataQualityFlags,
});

const buildInvalidInputRuntimeArtifacts = (input: {
  rawInput: unknown;
  context: PostActionVerificationRuntimeContext;
  issues: readonly ZodIssue[];
}) => {
  const startedAt = input.context.clock.now();
  const endedAt = input.context.clock.now();
  const inputRef = `invalid:post-action:${buildPostActionHash(input.rawInput).slice(0, 12)}`;
  const refs = buildPostActionDebugRefs(inputRef);
  const receivedShapeHash = buildInvalidPostActionShapeHash(input.rawInput, input.issues);
  return { startedAt, endedAt, refs, receivedShapeHash };
};

const buildInvalidInputRuntimeProof = (artifacts: ReturnType<typeof buildInvalidInputRuntimeArtifacts>) =>
  buildPostActionRuntimeProof({
    request: null,
    status: "failed",
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    observationRefs: [],
    evidenceRefs: [],
    outputRef: null,
    diagnosticPayloadRef: artifacts.refs.diagnosticPayloadRef,
    debugLogRef: artifacts.refs.debugLogRef,
    structuredRuntimeEventRef: artifacts.refs.structuredRuntimeEventRef,
    receivedShapeHash: artifacts.receivedShapeHash,
    processingMode: "invalid_input_failure",
    observationFingerprint: null,
    dataQualityFlags: ["output_boundary_violation"],
    startedAt: artifacts.startedAt,
    endedAt: artifacts.endedAt,
  });

const buildInvalidInputResultPayload = (input: {
  runtimeProof: ReturnType<typeof buildInvalidInputRuntimeProof>;
  artifacts: ReturnType<typeof buildInvalidInputRuntimeArtifacts>;
}) => ({
  ...buildEmptyPostActionRequestFields(),
  status: "failed",
  abilityGroupId: "post-action-verification",
  postActionVerificationResultRef: null,
  sourceActionResultRef: null,
  sourceActionRuntimeProofRef: null,
  sourceActionAbilityGroupId: null,
  sourceActionChildCapabilityId: null,
  beforeEvidenceRefs: [],
  afterEvidenceRefs: [],
  observationRefs: [],
  supportingSourceProofRefs: [],
  observationFingerprint: input.runtimeProof.observationFingerprint,
  packageStatus: "failed",
  output: null,
  failureReason: "input_schema_invalid",
  reviewRequiredReason: null,
  statusMessage: "Post Action Verification rejected invalid input schema.",
  debugLogRef: input.artifacts.refs.debugLogRef,
  structuredRuntimeEventRef: input.artifacts.refs.structuredRuntimeEventRef,
  diagnosticPayloadRef: input.artifacts.refs.diagnosticPayloadRef,
  runtimeProof: input.runtimeProof,
  dataQualityFlags: ["output_boundary_violation"],
});

export function createPostActionFailureResult(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  status: "failed" | "review_required";
  failureReason: PostActionVerificationAbilityResult["failureReason"];
  statusMessage: string;
  reviewRequiredReason?: string | null;
  dataQualityFlags?: string[];
}): PostActionVerificationAbilityResult {
  const artifacts = buildFailureArtifacts(input.request, input.context);
  const runtimeProof = buildFailureRuntimeProof({
    request: input.request,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    dataQualityFlags: input.dataQualityFlags ?? [],
    artifacts,
  });
  return parsePostActionResult(buildFailureResultPayload({
    request: input.request,
    status: input.status,
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    dataQualityFlags: input.dataQualityFlags ?? [],
    artifacts,
    runtimeProof,
  }));
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
  const artifacts = buildInvalidInputRuntimeArtifacts(input);
  const runtimeProof = buildInvalidInputRuntimeProof(artifacts);
  return parsePostActionResult(buildInvalidInputResultPayload({ artifacts, runtimeProof }));
}

export function createSuccessfulPostActionResult(input: {
  request: ParsedPostActionVerificationAbilityInput;
  childObservation: PostActionChildObservation;
  startedAt: { isoTimestamp: string; monotonicMs: number };
  endedAt: { isoTimestamp: string; monotonicMs: number };
}): PostActionVerificationAbilityResult {
  const refs = buildPostActionDebugRefs(input.request.inputRef);
  const observationFingerprint = buildPostActionObservationFingerprint(input.request, input.childObservation.supportingObservationRefs);
  const outputRef = `${input.request.inputRef}:output`;
  const runtimeProof = buildSuccessfulRuntimeProof({
    request: input.request,
    childObservation: input.childObservation,
    observationFingerprint,
    outputRef,
    refs,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });
  return parsePostActionResult(buildSuccessfulResultPayload({
    afterEvidenceRefs: buildAfterEvidenceRefs(input.request),
    beforeEvidenceRefs: buildBeforeEvidenceRefs(input.request),
    request: input.request,
    childObservation: input.childObservation,
    refs,
    observationFingerprint,
    outputRef,
    requestFields: buildPostActionRequestFields(input.request),
    runtimeProof,
  }));
}