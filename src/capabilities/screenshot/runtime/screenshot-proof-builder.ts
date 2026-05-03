import type { ScreenshotAbilityInput, ScreenshotArtifactRef, ScreenshotRuntimeProof, ScreenshotScaleMapping, ScreenshotSourceProof, ScreenshotStatus } from "../contract.js";
import { ScreenshotRuntimeProofSchema } from "../schema.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../shared/screenshot-types.js";
import { resolveScreenshotChain } from "./screenshot-chain.js";

const isScreenshotTimeoutFailure = (failureReason: ScreenshotRuntimeProof["failureReason"]): boolean =>
  failureReason?.code === "capture_timeout" || failureReason?.code === "image_processing_timeout";

const resolveScreenshotDiagnosticPayloadRef = (input: { inputRef: string; status: ScreenshotStatus }): string | null =>
  input.status === "success" ? null : `${input.inputRef}:diagnostic`;

const buildScreenshotTimeoutDecision = (input: {
  failureReason: ScreenshotRuntimeProof["failureReason"];
}): ScreenshotRuntimeProof["timeoutDecision"] => {
  return isScreenshotTimeoutFailure(input.failureReason)
    ? { status: "review_required", reason: input.failureReason?.code ?? "timeout_triggered" }
    : { status: "passed", reason: null };
};

const buildScreenshotAbortDecision = (input: {
  request: ScreenshotAbilityInput;
  failureReason: ScreenshotRuntimeProof["failureReason"];
}): ScreenshotRuntimeProof["abortDecision"] => {
  return input.request.childCapabilityId === "capture-browser-viewport" || input.request.childCapabilityId === "capture-desktop-screen"
    ? { status: "passed", reason: isScreenshotTimeoutFailure(input.failureReason) ? "timeout_abort_forwarded" : "abort_signal_wired" }
    : { status: "not_applicable", reason: null };
};

const buildScreenshotRegionDecision = (input: {
  request: ScreenshotAbilityInput;
  sourceProof: ScreenshotSourceProof | null;
}): ScreenshotRuntimeProof["regionDecision"] => {
  if (input.request.childCapabilityId !== "capture-region" && input.request.region === null) {
    return { status: "not_applicable", reason: null };
  }

  return input.sourceProof?.sourceScreenshotEvidenceId
    ? { status: "passed", reason: null }
    : { status: "failed", reason: "source_screenshot_evidence_required" };
};

const buildScreenshotScaleMappingDecision = (input: {
  request: ScreenshotAbilityInput;
  scaleMapping: ScreenshotScaleMapping | null;
}): ScreenshotRuntimeProof["scaleMappingDecision"] => {
  if (input.request.childCapabilityId === "capture-browser-viewport" || input.request.childCapabilityId === "capture-desktop-screen") {
    return { status: "not_applicable", reason: null };
  }

  return input.scaleMapping?.sourceScreenshotEvidenceId || input.request.childCapabilityId === "optimize-lossless"
    ? { status: "passed", reason: null }
    : { status: "failed", reason: "scale_mapping_required" };
};

function buildScreenshotRuntimeProofIdentityFields(input: {
  request: ScreenshotAbilityInput;
  proofId: string;
  runId: string | null;
  missionId: string | null;
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
  status: ScreenshotStatus;
  artifactLifecycleManifestRef?: string | null;
  retentionClass?: ScreenshotRuntimeProof["retentionClass"];
  promotionStatus?: ScreenshotRuntimeProof["promotionStatus"];
  expiresAt?: string | null;
  deleteAfter?: string | null;
  cleanupEligible?: boolean | null;
  artifactHash?: string | null;
  byteSize?: number | null;
}) {
  return {
    proofId: input.proofId,
    ...resolveScreenshotChain(input.request),
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    diagnosticPayloadRef: resolveScreenshotDiagnosticPayloadRef({ inputRef: input.inputRef, status: input.status }),
    sourceProofRef: input.sourceProof?.proofRef ?? null,
    pageStateProofRef: input.pageStateProofRef,
    browserSessionRef: input.browserSessionRef,
    screenshotEvidenceId: input.screenshotEvidenceId,
    artifactRef: input.artifactRef,
    sourceArtifactRef: input.sourceArtifactRef,
    artifactLifecycleManifestRef: input.artifactLifecycleManifestRef ?? null,
    retentionClass: input.retentionClass ?? null,
    promotionStatus: input.promotionStatus ?? null,
    expiresAt: input.expiresAt ?? null,
    deleteAfter: input.deleteAfter ?? null,
    cleanupEligible: input.cleanupEligible ?? null,
    sourceHash: input.sourceHash,
    outputHash: input.outputHash,
    artifactHash: input.artifactHash ?? null,
    byteSize: input.byteSize ?? null,
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
  request: ScreenshotAbilityInput;
  scaleMapping: ScreenshotScaleMapping | null;
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
    timeoutDecision: buildScreenshotTimeoutDecision({ failureReason: input.failureReason }),
    abortDecision: buildScreenshotAbortDecision({ request: input.request, failureReason: input.failureReason }),
    regionDecision: buildScreenshotRegionDecision({ request: input.request, sourceProof: input.sourceProof }),
    scaleMappingDecision: buildScreenshotScaleMappingDecision({ request: input.request, scaleMapping: input.scaleMapping }),
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
  runId: string | null;
  missionId: string | null;
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
  artifactLifecycleManifestRef?: string | null;
  retentionClass?: ScreenshotRuntimeProof["retentionClass"];
  promotionStatus?: ScreenshotRuntimeProof["promotionStatus"];
  expiresAt?: string | null;
  deleteAfter?: string | null;
  cleanupEligible?: boolean | null;
  artifactHash?: string | null;
  byteSize?: number | null;
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
