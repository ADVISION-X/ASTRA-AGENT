import { createHash } from "node:crypto";

import type {
  ScreenshotAbilityResult,
  ScreenshotRuntimeProof,
  ScreenshotScaleMapping,
} from "../contract.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../shared/screenshot-types.js";
import { finishScreenshotClock } from "./screenshot-clock.js";
import { buildScreenshotRuntimeProof } from "./screenshot-proof-builder.js";
import { buildScreenshotResult } from "./screenshot-result-builder.js";
import type { ScreenshotSuccessPathInput } from "./screenshot-execution-success-helpers.js";
import { isProductPresenceLightweightObservation } from "./screenshot-lightweight-observation.js";

function buildRef(prefix: string, input: string): string {
  return `${prefix}:${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

type ScreenshotSuccessClockFinish = ReturnType<typeof finishScreenshotClock>;

type ScreenshotSuccessRuntimeProofInput = {
  pathInput: ScreenshotSuccessPathInput;
  finished: ScreenshotSuccessClockFinish;
  sourceHash: string;
  scaleMapping: ScreenshotScaleMapping | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  outputWidth: number | null;
  outputHeight: number | null;
  dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"];
  outputBoundaryDecision: ScreenshotRuntimeProof["outputBoundaryDecision"];
};

function compactDataQualityFlags(input: Array<ScreenshotRuntimeProof["dataQualityFlags"][number] | null>) {
  return input.filter((value): value is ScreenshotRuntimeProof["dataQualityFlags"][number] => value !== null);
}

function buildBaselineSuccessDataQualityFlags(input: ScreenshotSuccessPathInput) {
  return compactDataQualityFlags([
    "artifact_persisted",
    "artifact_budget_verified",
    "artifact_lifecycle_manifest_written",
    isProductPresenceLightweightObservation(input.request) ? "observation_lightweight_applied" : null,
    input.plan.kind === "capture" ? "capture_fresh" : "scale_mapping_verified",
  ]);
}

function buildConditionalSuccessDataQualityFlags(input: ScreenshotSuccessPathInput) {
  return compactDataQualityFlags([
    input.gates.browserSessionGate.decision.status === "passed" ? "browser_session_verified" : null,
    input.gates.pageStateGate.pageStateProofRef ? "page_state_verified" : "page_state_unverified",
    input.regionGate.decision.status === "passed" ? "region_proof_verified" : null,
    input.plan.kind === "image-processing" && input.plan.operation === "optimize-lossless" ? "lossless_equivalence_verified" : null,
    input.request.childCapabilityId === "capture-desktop-screen" ? "desktop_capture_requested" : null,
  ]);
}

const buildScreenshotSuccessDataQualityFlags = (input: ScreenshotSuccessPathInput): ScreenshotRuntimeProof["dataQualityFlags"] => [
  ...buildBaselineSuccessDataQualityFlags(input),
  ...buildConditionalSuccessDataQualityFlags(input),
];

const buildScreenshotSuccessRuntimeProofIdentityFields = (input: ScreenshotSuccessRuntimeProofInput) => ({
  proofId: buildRef("screenshot-proof", `${input.pathInput.scope.inputRef}:${input.pathInput.scope.idempotencyKey}:success`),
  runId: input.pathInput.scope.runId,
  missionId: input.pathInput.scope.missionId,
  sessionId: input.pathInput.request.sessionId,
  roundId: input.pathInput.request.roundId,
  videoVisitId: input.pathInput.request.videoVisitId,
  abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
  childCapabilityId: input.pathInput.request.childCapabilityId,
  sourceAbilityGroupId: input.pathInput.request.sourceAbilityGroupId,
  sourceChildCapabilityId: input.pathInput.request.sourceChildCapabilityId,
  inputRef: input.pathInput.scope.inputRef,
  outputRef: input.pathInput.scope.outputRef,
  sourceProofRef: input.pathInput.gates.sourceGate.sourceProof?.proofRef ?? null,
  pageStateProofRef: input.pathInput.gates.pageStateGate.pageStateProofRef,
  browserSessionRef: input.pathInput.gates.browserSessionGate.browserSessionRef,
  screenshotEvidenceId: input.pathInput.scope.evidenceId,
  artifactRef: input.pathInput.artifactGate.artifactRef,
  sourceArtifactRef: input.pathInput.gates.sourceGate.sourceProof?.sourceArtifactRef ?? null,
  artifactLifecycleManifestRef: input.pathInput.artifactGate.artifactLifecycleManifestRef,
  retentionClass: input.pathInput.artifactGate.retentionClass,
  promotionStatus: input.pathInput.artifactGate.promotionStatus,
  expiresAt: input.pathInput.artifactGate.expiresAt,
  deleteAfter: input.pathInput.artifactGate.deleteAfter,
  cleanupEligible: input.pathInput.artifactGate.cleanupEligible,
  sourceHash: input.sourceHash,
  outputHash: input.pathInput.artifactGate.outputHash,
  artifactHash: input.pathInput.artifactGate.artifactHash,
  byteSize: input.pathInput.artifactGate.byteSize,
  sourceWidth: input.pathInput.plan.kind === "capture" ? input.outputWidth : (input.pathInput.imageRun?.output?.sourceWidth ?? input.pathInput.gates.sourceGate.sourceProof?.sourceWidth ?? null),
  sourceHeight: input.pathInput.plan.kind === "capture" ? input.outputHeight : (input.pathInput.imageRun?.output?.sourceHeight ?? input.pathInput.gates.sourceGate.sourceProof?.sourceHeight ?? null),
  outputWidth: input.outputWidth,
  outputHeight: input.outputHeight,
  coordinateSpace: input.coordinateSpace,
  sourceCoordinateSpace: input.pathInput.gates.sourceGate.sourceProof?.coordinateSpace ?? null,
  scaleMapping: input.scaleMapping,
  region: input.pathInput.request.region,
});

const buildScreenshotSuccessRuntimeProofDecisionFields = (input: ScreenshotSuccessRuntimeProofInput) => ({
  idempotencyKey: input.pathInput.scope.idempotencyKey,
  startedAt: input.pathInput.clockStart.startedAt,
  endedAt: input.finished.endedAt,
  durationMs: input.finished.durationMs,
  capturePhaseMs: input.pathInput.phaseTimings.capturePhaseMs,
  imageProcessingPhaseMs: input.pathInput.phaseTimings.imageProcessingPhaseMs,
  artifactStoragePhaseMs: input.pathInput.phaseTimings.artifactStoragePhaseMs,
  outputBoundaryPhaseMs: input.pathInput.phaseTimings.outputBoundaryPhaseMs,
  totalScreenshotStepMs: input.finished.durationMs,
  status: "success" as const,
  failureReason: null,
  reviewRequiredReason: null,
  privacyDecision: input.pathInput.gates.privacyGate.decision,
  sourceDecision: input.pathInput.gates.sourceGate.decision,
  browserSessionDecision: input.pathInput.gates.browserSessionGate.decision,
  pageStateDecision: input.pathInput.gates.pageStateGate.decision,
  captureDecision: input.pathInput.captureRun?.decision ?? { status: "not_applicable" as const, reason: null },
  imageProcessingDecision: input.pathInput.imageRun?.decision ?? { status: "not_applicable" as const, reason: null },
  artifactDecision: input.pathInput.artifactGate.decision,
  outputBoundaryDecision: input.outputBoundaryDecision,
  clock: {
    portKind: "system-monotonic-screenshot-clock" as const,
    startedMonotonicMs: input.pathInput.clockStart.startedMonotonicMs,
    endedMonotonicMs: input.finished.endedMonotonicMs,
  },
  dataQualityFlags: input.dataQualityFlags,
});

function resolveScreenshotSuccessRuntimeProofFields(input: ScreenshotSuccessRuntimeProofInput) {
  const identity = buildScreenshotSuccessRuntimeProofIdentityFields(input);
  const decisions = buildScreenshotSuccessRuntimeProofDecisionFields(input);
  return { identity, decisions };
}

function buildScreenshotSuccessRuntimeProofScalarPayload(fields: ReturnType<typeof resolveScreenshotSuccessRuntimeProofFields>) {
  return {
    proofId: fields.identity.proofId,
    runId: fields.identity.runId,
    missionId: fields.identity.missionId,
    inputRef: fields.identity.inputRef,
    outputRef: fields.identity.outputRef,
    artifactRef: fields.identity.artifactRef,
    artifactLifecycleManifestRef: fields.identity.artifactLifecycleManifestRef,
    retentionClass: fields.identity.retentionClass,
    promotionStatus: fields.identity.promotionStatus,
    expiresAt: fields.identity.expiresAt,
    deleteAfter: fields.identity.deleteAfter,
    cleanupEligible: fields.identity.cleanupEligible,
    sourceHash: fields.identity.sourceHash,
    outputHash: fields.identity.outputHash,
    artifactHash: fields.identity.artifactHash,
    byteSize: fields.identity.byteSize,
    sourceWidth: fields.identity.sourceWidth,
    sourceHeight: fields.identity.sourceHeight,
    outputWidth: fields.identity.outputWidth,
    outputHeight: fields.identity.outputHeight,
    coordinateSpace: fields.identity.coordinateSpace,
    scaleMapping: fields.identity.scaleMapping,
    browserSessionRef: fields.identity.browserSessionRef,
    pageStateProofRef: fields.identity.pageStateProofRef,
    screenshotEvidenceId: fields.identity.screenshotEvidenceId,
  };
}

function buildScreenshotSuccessRuntimeProofDecisionPayload(fields: ReturnType<typeof resolveScreenshotSuccessRuntimeProofFields>) {
  return {
    idempotencyKey: fields.decisions.idempotencyKey,
    startedAt: fields.decisions.startedAt,
    endedAt: fields.decisions.endedAt,
    durationMs: fields.decisions.durationMs,
    startedMonotonicMs: fields.decisions.clock.startedMonotonicMs,
    endedMonotonicMs: fields.decisions.clock.endedMonotonicMs,
    status: fields.decisions.status,
    failureReason: fields.decisions.failureReason,
    reviewRequiredReason: fields.decisions.reviewRequiredReason,
    decisions: {
      privacyDecision: fields.decisions.privacyDecision,
      sourceDecision: fields.decisions.sourceDecision,
      browserSessionDecision: fields.decisions.browserSessionDecision,
      pageStateDecision: fields.decisions.pageStateDecision,
      captureDecision: fields.decisions.captureDecision,
      imageProcessingDecision: fields.decisions.imageProcessingDecision,
      artifactDecision: fields.decisions.artifactDecision,
      outputBoundaryDecision: fields.decisions.outputBoundaryDecision,
    },
    dataQualityFlags: fields.decisions.dataQualityFlags,
  };
}

function buildScreenshotSuccessRuntimeProofPayload(
  input: ScreenshotSuccessRuntimeProofInput,
  fields: ReturnType<typeof resolveScreenshotSuccessRuntimeProofFields>,
) {
  return {
    request: input.pathInput.request,
    sourceProof: input.pathInput.gates.sourceGate.sourceProof,
    sourceArtifactRef: input.pathInput.gates.sourceGate.sourceProof?.sourceArtifactRef ?? null,
    ...buildScreenshotSuccessRuntimeProofScalarPayload(fields),
    ...buildScreenshotSuccessRuntimeProofDecisionPayload(fields),
  };
}

const buildScreenshotSuccessRuntimeProof = (input: ScreenshotSuccessRuntimeProofInput): ScreenshotRuntimeProof => {
  const fields = resolveScreenshotSuccessRuntimeProofFields(input);
  return buildScreenshotRuntimeProof(buildScreenshotSuccessRuntimeProofPayload(input, fields));
};

export const buildScreenshotSuccessResult = async (input: {
  pathInput: ScreenshotSuccessPathInput;
  sourceHash: string;
  scaleMapping: ScreenshotScaleMapping | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  outputWidth: number | null;
  outputHeight: number | null;
  successOutput: NonNullable<ScreenshotAbilityResult["output"]>;
  outputBoundaryDecision: ScreenshotRuntimeProof["outputBoundaryDecision"];
}): Promise<ScreenshotAbilityResult> => {
  const finished = finishScreenshotClock({
    clockPort: input.pathInput.context.clockPort,
    startedAt: input.pathInput.clockStart.startedAt,
    startedMonotonicMs: input.pathInput.clockStart.startedMonotonicMs,
  });
  const dataQualityFlags = buildScreenshotSuccessDataQualityFlags(input.pathInput);
  const runtimeProof = buildScreenshotSuccessRuntimeProof({
    pathInput: input.pathInput,
    finished,
    sourceHash: input.sourceHash,
    scaleMapping: input.scaleMapping,
    coordinateSpace: input.coordinateSpace,
    outputWidth: input.outputWidth,
    outputHeight: input.outputHeight,
    dataQualityFlags,
    outputBoundaryDecision: input.outputBoundaryDecision,
  });

  return buildScreenshotResult({
    request: input.pathInput.request,
    status: "success",
    message: "Screenshot execution succeeded.",
    output: input.successOutput,
    failureReason: null,
    reviewRequiredReason: null,
    runtimeProof,
  });
};