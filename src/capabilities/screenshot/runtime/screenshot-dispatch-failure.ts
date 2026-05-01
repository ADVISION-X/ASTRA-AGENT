import type {
  ScreenshotAbilityInput,
  ScreenshotAbilityResult,
  ScreenshotArtifactRef,
  ScreenshotFailure,
  ScreenshotRuntimeProof,
  ScreenshotSourceProof,
  ScreenshotStatus,
} from "../contract.js";
import { buildScreenshotResult } from "./screenshot-result-builder.js";
import { buildScreenshotRuntimeProof } from "./screenshot-proof-builder.js";

function buildScreenshotFailureRuntimeProof(input: {
  request: ScreenshotAbilityInput;
  proofId: string;
  runId: string;
  missionId: string;
  inputRef: string;
  idempotencyKey: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  status: Exclude<ScreenshotStatus, "success">;
  failureReason: ScreenshotFailure | null;
  reviewRequiredReason: string | null;
  sourceProof: ScreenshotSourceProof | null;
  sourceArtifactRef: ScreenshotArtifactRef | null;
  browserSessionRef: string | null;
  pageStateProofRef: string | null;
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
}) {
  return buildScreenshotRuntimeProof({
    request: input.request,
    proofId: input.proofId,
    runId: input.runId,
    missionId: input.missionId,
    inputRef: input.inputRef,
    outputRef: null,
    idempotencyKey: input.idempotencyKey,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    sourceProof: input.sourceProof,
    artifactRef: null,
    sourceArtifactRef: input.sourceArtifactRef,
    sourceHash: input.sourceProof?.sourceHash ?? null,
    outputHash: null,
    sourceWidth: input.sourceProof?.sourceWidth ?? null,
    sourceHeight: input.sourceProof?.sourceHeight ?? null,
    outputWidth: null,
    outputHeight: null,
    coordinateSpace: null,
    scaleMapping: null,
    browserSessionRef: input.browserSessionRef,
    pageStateProofRef: input.pageStateProofRef,
    screenshotEvidenceId: null,
    decisions: input.decisions,
    dataQualityFlags: input.dataQualityFlags,
  });
}

function buildScreenshotFailureResult(input: {
  request: ScreenshotAbilityInput;
  status: Exclude<ScreenshotStatus, "success">;
  message: string;
  failureReason: ScreenshotFailure | null;
  reviewRequiredReason: string | null;
  runtimeProof: ScreenshotRuntimeProof;
}): ScreenshotAbilityResult {
  return buildScreenshotResult({
    request: input.request,
    status: input.status,
    message: input.message,
    output: null,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    runtimeProof: input.runtimeProof,
  });
}

export function dispatchScreenshotFailure(input: {
  request: ScreenshotAbilityInput;
  status: Exclude<ScreenshotStatus, "success">;
  message: string;
  failureReason: ScreenshotFailure | null;
  reviewRequiredReason: string | null;
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
  sourceProof: ScreenshotSourceProof | null;
  sourceArtifactRef: ScreenshotArtifactRef | null;
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
  browserSessionRef: string | null;
  pageStateProofRef: string | null;
  dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"];
}): ScreenshotAbilityResult {
  const runtimeProof = buildScreenshotFailureRuntimeProof({
    request: input.request,
    proofId: input.proofId,
    runId: input.runId,
    missionId: input.missionId,
    inputRef: input.inputRef,
    idempotencyKey: input.idempotencyKey,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    sourceProof: input.sourceProof,
    sourceArtifactRef: input.sourceArtifactRef,
    browserSessionRef: input.browserSessionRef,
    pageStateProofRef: input.pageStateProofRef,
    decisions: input.decisions,
    dataQualityFlags: input.dataQualityFlags,
  });

  return buildScreenshotFailureResult({
    request: input.request,
    status: input.status,
    message: input.message,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    runtimeProof,
  });
}
