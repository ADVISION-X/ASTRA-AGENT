import type { ZodIssue } from "zod";

import { PageStateAbilityResultSchema } from "../schema.js";
import type {
  PageStateAbilityInput,
  PageStateAbilityResult,
  PageStateChildObservation,
  PageStateFailureReason,
} from "../schema.js";
import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import {
  buildPageStateDebugRefs,
  buildPageStateHash,
  buildPageStateObservationFingerprint,
  buildPageStateRuntimeProof,
} from "./page-state-runtime-proof-builder.js";

function buildPageStateRequestFields(request: PageStateAbilityInput) {
  return {
    childCapabilityId: request.childCapabilityId,
    runId: request.runId,
    missionId: request.missionId,
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
  };
}

function buildEmptyPageStateRequestFields() {
  return {
    childCapabilityId: null,
    runId: null,
    missionId: null,
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
  };
}

function buildFailureArtifacts(request: PageStateAbilityInput, clock: PageStateClockPort) {
  return {
    startedAt: clock.now(),
    endedAt: clock.now(),
    refs: buildPageStateDebugRefs(request.inputRef),
    observationRefs: request.observations.map((observation) => observation.observationId),
  };
}

export function createPageStateFailureResult(input: {
  request: PageStateAbilityInput;
  failureReason: PageStateFailureReason;
  reviewRequiredReason?: string | null;
  status: "failed" | "review_required";
  clock: PageStateClockPort;
}): PageStateAbilityResult {
  const artifacts = buildFailureArtifacts(input.request, input.clock);
  const runtimeProof = buildPageStateRuntimeProof({
    request: input.request,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    observationRefs: artifacts.observationRefs,
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    clockStartedAt: artifacts.startedAt,
    clockEndedAt: artifacts.endedAt,
    outputRef: null,
    diagnosticPayloadRef: artifacts.refs.diagnosticPayloadRef,
    debugLogRef: artifacts.refs.debugLogRef,
    structuredRuntimeEventRef: artifacts.refs.structuredRuntimeEventRef,
    receivedShapeHash: null,
    processingMode: "observation_packaging",
    observationFingerprint: buildPageStateObservationFingerprint(input.request, artifacts.observationRefs),
  });

  return PageStateAbilityResultSchema.parse({
    ...buildPageStateRequestFields(input.request),
    status: input.status,
    abilityGroupId: "page-state",
    output: null,
    observationSummary: null,
    evidenceRefs: [],
    observationRefs: artifacts.observationRefs,
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    observationFingerprint: runtimeProof.observationFingerprint,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    dataQualityFlags: runtimeProof.dataQualityFlags,
    debugLogRef: artifacts.refs.debugLogRef,
    structuredRuntimeEventRef: artifacts.refs.structuredRuntimeEventRef,
    diagnosticPayloadRef: artifacts.refs.diagnosticPayloadRef,
    receivedShapeHash: null,
    runtimeProof,
  });
}

function buildInvalidPageStateShapeHash(rawInput: unknown, issues: readonly ZodIssue[]) {
  return buildPageStateHash({
    rawInput,
    issues: issues.map((issue) => ({ path: issue.path, message: issue.message })),
  });
}

function buildInvalidPageStateArtifacts(rawInput: unknown, issues: readonly ZodIssue[], clock: PageStateClockPort) {
  const startedAt = clock.now();
  const endedAt = clock.now();
  const inputRef = `invalid:page-state:${buildPageStateHash(rawInput).slice(0, 12)}`;
  return {
    startedAt,
    endedAt,
    refs: buildPageStateDebugRefs(inputRef),
    receivedShapeHash: buildInvalidPageStateShapeHash(rawInput, issues),
  };
}

function buildInvalidPageStatePayload(input: {
  refs: ReturnType<typeof buildPageStateDebugRefs>;
  receivedShapeHash: string;
  runtimeProof: ReturnType<typeof buildPageStateRuntimeProof>;
}) {
  return {
    ...buildEmptyPageStateRequestFields(),
    status: "failed" as const,
    abilityGroupId: "page-state" as const,
    output: null,
    observationSummary: null,
    evidenceRefs: [],
    observationRefs: [],
    sourceEvidenceRefs: [],
    observationFingerprint: null,
    failureReason: "invalid_input" as const,
    reviewRequiredReason: null,
    dataQualityFlags: ["output_boundary_violation"],
    debugLogRef: input.refs.debugLogRef,
    structuredRuntimeEventRef: input.refs.structuredRuntimeEventRef,
    diagnosticPayloadRef: input.refs.diagnosticPayloadRef,
    receivedShapeHash: input.receivedShapeHash,
    runtimeProof: input.runtimeProof,
  };
}

export function createInvalidPageStateInputResult(input: {
  rawInput: unknown;
  issues: readonly ZodIssue[];
  clock: PageStateClockPort;
}): PageStateAbilityResult {
  const artifacts = buildInvalidPageStateArtifacts(input.rawInput, input.issues, input.clock);
  const runtimeProof = buildPageStateRuntimeProof({
    request: null,
    status: "failed",
    failureReason: "invalid_input",
    reviewRequiredReason: null,
    observationRefs: [],
    sourceEvidenceRefs: [],
    clockStartedAt: artifacts.startedAt,
    clockEndedAt: artifacts.endedAt,
    outputRef: null,
    diagnosticPayloadRef: artifacts.refs.diagnosticPayloadRef,
    debugLogRef: artifacts.refs.debugLogRef,
    structuredRuntimeEventRef: artifacts.refs.structuredRuntimeEventRef,
    receivedShapeHash: artifacts.receivedShapeHash,
    processingMode: "invalid_input_failure",
    observationFingerprint: null,
  });

  return PageStateAbilityResultSchema.parse(buildInvalidPageStatePayload({
    refs: artifacts.refs,
    receivedShapeHash: artifacts.receivedShapeHash,
    runtimeProof,
  }));
}

function buildSuccessfulPageStateOutput(input: {
  childObservation: PageStateChildObservation;
  observationFingerprint: string;
}) {
  return {
    packageLabel: input.childObservation.packageLabel,
    observationSummary: input.childObservation.observationSummary,
    evidenceRefs: input.childObservation.supportingEvidenceRefs,
    observationRefs: input.childObservation.matchedObservationIds,
    observationFingerprint: input.observationFingerprint,
  };
}

export function createSuccessfulPageStateResult(input: {
  request: PageStateAbilityInput;
  childObservation: PageStateChildObservation;
  startedAt: { isoTimestamp: string; epochMs: number };
  endedAt: { isoTimestamp: string; epochMs: number };
}): PageStateAbilityResult {
  const refs = buildPageStateDebugRefs(input.request.inputRef);
  const observationFingerprint = buildPageStateObservationFingerprint(input.request, input.childObservation.matchedObservationIds);
  const runtimeProof = buildPageStateRuntimeProof({
    request: input.request,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    observationRefs: input.childObservation.matchedObservationIds,
    sourceEvidenceRefs: input.childObservation.supportingEvidenceRefs,
    clockStartedAt: input.startedAt,
    clockEndedAt: input.endedAt,
    outputRef: `${input.request.inputRef}:output`,
    diagnosticPayloadRef: null,
    debugLogRef: refs.debugLogRef,
    structuredRuntimeEventRef: refs.structuredRuntimeEventRef,
    receivedShapeHash: null,
    processingMode: "observation_packaging",
    observationFingerprint,
  });

  return PageStateAbilityResultSchema.parse({
    ...buildPageStateRequestFields(input.request),
    status: "success",
    abilityGroupId: "page-state",
    output: buildSuccessfulPageStateOutput({ childObservation: input.childObservation, observationFingerprint }),
    observationSummary: input.childObservation.observationSummary,
    evidenceRefs: input.childObservation.supportingEvidenceRefs,
    observationRefs: input.childObservation.matchedObservationIds,
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    observationFingerprint,
    failureReason: null,
    reviewRequiredReason: null,
    dataQualityFlags: input.childObservation.dataQualityFlags,
    debugLogRef: refs.debugLogRef,
    structuredRuntimeEventRef: refs.structuredRuntimeEventRef,
    diagnosticPayloadRef: null,
    receivedShapeHash: null,
    runtimeProof,
  });
}