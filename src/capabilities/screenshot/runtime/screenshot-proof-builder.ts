import type { ScreenshotAbilityInput, ScreenshotArtifactRef, ScreenshotRuntimeProof, ScreenshotScaleMapping, ScreenshotSourceProof, ScreenshotStatus } from "../contract.js";
import { ScreenshotRuntimeProofSchema } from "../schema.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../shared/screenshot-types.js";

function buildScreenshotRuntimeProofIdentityFields(input: {
  request: ScreenshotAbilityInput;
  proofId: string;
  runId: string;
  missionId: string;
  inputRef: string;
  outputRef: string | null;
  sourceProof: ScreenshotSourceProof | null;
  artifactRef: ScreenshotArtifactRef | null;
  sourceArtifactRef: ScreenshotArtifactRef | null;
  sourceHash: string | null;
  outputHash: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  scaleMapping: ScreenshotScaleMapping | null;
  browserSessionRef: string | null;
  pageStateProofRef: string | null;
  screenshotEvidenceId: string | null;
}) {
  return {
    proofId: input.proofId,
    runId: input.runId,
    missionId: input.missionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    sourceProofRef: input.sourceProof?.proofRef ?? null,
    pageStateProofRef: input.pageStateProofRef,
    browserSessionRef: input.browserSessionRef,
    screenshotEvidenceId: input.screenshotEvidenceId,
    artifactRef: input.artifactRef,
    sourceArtifactRef: input.sourceArtifactRef,
    sourceHash: input.sourceHash,
    outputHash: input.outputHash,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    outputWidth: input.outputWidth,
    outputHeight: input.outputHeight,
    coordinateSpace: input.coordinateSpace,
    sourceCoordinateSpace: input.sourceProof?.coordinateSpace ?? null,
    scaleMapping: input.scaleMapping,
    region: input.request.region,
  };
}

function buildScreenshotRuntimeProofDecisionFields(input: {
  idempotencyKey: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: ScreenshotStatus;
  failureReason: ScreenshotRuntimeProof["failureReason"];
  reviewRequiredReason: string | null;
  decisions: {
    privacyDecision: ScreenshotRuntimeProof["privacyDecision"];
    sourceDecision: ScreenshotRuntimeProof["sourceDecision"];
    browserSessionDecision: ScreenshotRuntimeProof["browserSessionDecision"];
    pageStateDecision: ScreenshotRuntimeProof["pageStateDecision"];
    captureDecision: ScreenshotRuntimeProof["captureDecision"];
    imageProcessingDecision: ScreenshotRuntimeProof["imageProcessingDecision"];
    artifactDecision: ScreenshotRuntimeProof["artifactDecision"];
    outputBoundaryDecision: ScreenshotRuntimeProof["outputBoundaryDecision"];
  };
  dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"];
  sourceProof: ScreenshotSourceProof | null;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
}) {
  return {
    idempotencyKey: input.idempotencyKey,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    privacyDecision: input.decisions.privacyDecision,
    sourceDecision: input.decisions.sourceDecision,
    browserSessionDecision: input.decisions.browserSessionDecision,
    pageStateDecision: input.decisions.pageStateDecision,
    captureDecision: input.decisions.captureDecision,
    imageProcessingDecision: input.decisions.imageProcessingDecision,
    artifactDecision: input.decisions.artifactDecision,
    outputBoundaryDecision: input.decisions.outputBoundaryDecision,
    clock: {
      portKind: "system-monotonic-screenshot-clock",
      startedMonotonicMs: input.startedMonotonicMs,
      endedMonotonicMs: input.endedMonotonicMs,
    },
    dataQualityFlags: input.dataQualityFlags,
  };
}

export function buildScreenshotRuntimeProof(input: {
  request: ScreenshotAbilityInput;
  proofId: string;
  runId: string;
  missionId: string;
  inputRef: string;
  outputRef: string | null;
  idempotencyKey: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  status: ScreenshotStatus;
  failureReason: ScreenshotRuntimeProof["failureReason"];
  reviewRequiredReason: string | null;
  sourceProof: ScreenshotSourceProof | null;
  artifactRef: ScreenshotArtifactRef | null;
  sourceArtifactRef: ScreenshotArtifactRef | null;
  sourceHash: string | null;
  outputHash: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  scaleMapping: ScreenshotScaleMapping | null;
  browserSessionRef: string | null;
  pageStateProofRef: string | null;
  screenshotEvidenceId: string | null;
  decisions: {
    privacyDecision: ScreenshotRuntimeProof["privacyDecision"];
    sourceDecision: ScreenshotRuntimeProof["sourceDecision"];
    browserSessionDecision: ScreenshotRuntimeProof["browserSessionDecision"];
    pageStateDecision: ScreenshotRuntimeProof["pageStateDecision"];
    captureDecision: ScreenshotRuntimeProof["captureDecision"];
    imageProcessingDecision: ScreenshotRuntimeProof["imageProcessingDecision"];
    artifactDecision: ScreenshotRuntimeProof["artifactDecision"];
    outputBoundaryDecision: ScreenshotRuntimeProof["outputBoundaryDecision"];
  };
  dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"];
}): ScreenshotRuntimeProof {
  return ScreenshotRuntimeProofSchema.parse({
    ...buildScreenshotRuntimeProofIdentityFields(input),
    ...buildScreenshotRuntimeProofDecisionFields(input),
  });
}
