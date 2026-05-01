import type {
  ScreenshotAbilityInput,
  ScreenshotFailure,
  ScreenshotRuntimeProof,
  ScreenshotSourceProof,
  ScreenshotStatus,
} from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { dispatchScreenshotExecutionFailure } from "./screenshot-execution-failure.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";

export type ScreenshotFailureGateDecision = ScreenshotRuntimeProof["privacyDecision"];

export type ScreenshotFailureGateState = {
  failure: { message: string } | null;
  decision: ScreenshotFailureGateDecision;
};

export type ScreenshotFailureSourceGateState = ScreenshotFailureGateState & {
  sourceProof: ScreenshotSourceProof | null;
};

export type ScreenshotFailureBrowserSessionGateState = ScreenshotFailureGateState & {
  browserSessionRef: string | null;
};

export type ScreenshotFailurePageStateGateState = ScreenshotFailureGateState & {
  pageStateProofRef: string | null;
};

export type ScreenshotExecutionFailureContext = {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  sourceGate: ScreenshotFailureSourceGateState;
  browserSessionGate: ScreenshotFailureBrowserSessionGateState;
  pageStateGate: ScreenshotFailurePageStateGateState;
  privacyGate: ScreenshotFailureGateState;
};

async function dispatchScreenshotFailureResult(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  status: Exclude<ScreenshotStatus, "success">;
  message: string;
  failureReason: ScreenshotFailure | null;
  reviewRequiredReason: string | null;
  sourceProof: ScreenshotSourceProof | null;
  browserSessionRef: string | null;
  pageStateProofRef: string | null;
  decisions: ScreenshotRuntimeProof["decisions"];
  dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"];
}): Promise<ScreenshotAbilityResult> {
  return dispatchScreenshotExecutionFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    status: input.status,
    message: input.message,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    startedAt: input.clockStart.startedAt,
    startedMonotonicMs: input.clockStart.startedMonotonicMs,
    sourceProof: input.sourceProof,
    browserSessionRef: input.browserSessionRef,
    pageStateProofRef: input.pageStateProofRef,
    dataQualityFlags: input.dataQualityFlags,
    decisions: input.decisions,
  });
}

export async function buildScreenshotPlanValidationFailure(input: ScreenshotExecutionFailureContext & {
  failEarly: { message: string } | null;
  earlyStatus: "failed" | "review_required";
}): Promise<ScreenshotAbilityResult> {
  return dispatchScreenshotFailureResult({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    status: input.earlyStatus,
    message: input.failEarly?.message ?? "Screenshot governance gate blocked execution.",
    failureReason: input.failEarly ?? createScreenshotFailure({
      code: "dispatch_failure",
      message: "Screenshot governance gate blocked execution.",
    }),
    reviewRequiredReason: input.earlyStatus === "review_required" ? (input.failEarly?.message ?? "review required") : null,
    sourceProof: input.sourceGate.sourceProof,
    browserSessionRef: input.browserSessionGate.browserSessionRef,
    pageStateProofRef: input.pageStateGate.pageStateProofRef,
    dataQualityFlags: [],
    decisions: {
      privacyDecision: input.privacyGate.decision,
      sourceDecision: input.sourceGate.decision,
      browserSessionDecision: input.browserSessionGate.decision,
      pageStateDecision: input.pageStateGate.decision,
      captureDecision: { status: "not_applicable", reason: null },
      imageProcessingDecision: { status: "not_applicable", reason: null },
      artifactDecision: { status: "not_applicable", reason: null },
      outputBoundaryDecision: { status: "not_applicable", reason: null },
    },
  });
}

export async function buildScreenshotRegionValidationFailure(input: ScreenshotExecutionFailureContext & {
  regionGate: { failure: { message: string } | null; decision: ScreenshotFailureGateDecision };
}): Promise<ScreenshotAbilityResult> {
  return dispatchScreenshotFailureResult({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    status: "failed",
    message: input.regionGate.failure?.message ?? "Screenshot region proof gate failed.",
    failureReason: input.regionGate.failure ?? createScreenshotFailure({
      code: "region_proof_invalid",
      message: "Screenshot region proof gate failed.",
    }),
    reviewRequiredReason: null,
    sourceProof: input.sourceGate.sourceProof,
    browserSessionRef: input.browserSessionGate.browserSessionRef,
    pageStateProofRef: input.pageStateGate.pageStateProofRef,
    dataQualityFlags: [],
    decisions: {
      privacyDecision: input.privacyGate.decision,
      sourceDecision: input.sourceGate.decision,
      browserSessionDecision: input.browserSessionGate.decision,
      pageStateDecision: input.pageStateGate.decision,
      captureDecision: { status: "not_applicable", reason: null },
      imageProcessingDecision: input.regionGate.decision,
      artifactDecision: { status: "not_applicable", reason: null },
      outputBoundaryDecision: { status: "not_applicable", reason: null },
    },
  });
}

export async function buildScreenshotCaptureExecutionFailure(input: ScreenshotExecutionFailureContext & {
  captureRun: { failure: { message: string } | null; decision: ScreenshotFailureGateDecision } | null;
  imageRun: { failure: { message: string } | null; decision: ScreenshotFailureGateDecision } | null;
  executionFailure: { message: string } | null;
  status: "failed" | "review_required";
}): Promise<ScreenshotAbilityResult> {
  return dispatchScreenshotFailureResult({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    status: input.status,
    message: input.executionFailure?.message ?? "Screenshot execution failed.",
    failureReason: input.executionFailure ?? createScreenshotFailure({
      code: "dispatch_failure",
      message: "Screenshot execution failed before artifact persistence.",
    }),
    reviewRequiredReason: input.status === "review_required" ? (input.executionFailure?.message ?? "review required") : null,
    sourceProof: input.sourceGate.sourceProof,
    browserSessionRef: input.browserSessionGate.browserSessionRef,
    pageStateProofRef: input.pageStateGate.pageStateProofRef,
    dataQualityFlags: [],
    decisions: {
      privacyDecision: input.privacyGate.decision,
      sourceDecision: input.sourceGate.decision,
      browserSessionDecision: input.browserSessionGate.decision,
      pageStateDecision: input.pageStateGate.decision,
      captureDecision: input.captureRun?.decision ?? { status: "not_applicable", reason: null },
      imageProcessingDecision: input.imageRun?.decision ?? { status: "not_applicable", reason: null },
      artifactDecision: { status: "not_applicable", reason: null },
      outputBoundaryDecision: { status: "not_applicable", reason: null },
    },
  });
}

export async function buildScreenshotOutputMetadataFailure(input: ScreenshotExecutionFailureContext & {
  captureRun: { failure: { message: string } | null; decision: ScreenshotFailureGateDecision } | null;
  imageRun: { failure: { message: string } | null; decision: ScreenshotFailureGateDecision } | null;
}): Promise<ScreenshotAbilityResult> {
  return dispatchScreenshotFailureResult({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    status: "failed",
    message: "Screenshot execution produced incomplete output metadata.",
    failureReason: createScreenshotFailure({
      code: "dispatch_failure",
      message: "Screenshot execution produced incomplete output metadata.",
    }),
    reviewRequiredReason: null,
    sourceProof: input.sourceGate.sourceProof,
    browserSessionRef: input.browserSessionGate.browserSessionRef,
    pageStateProofRef: input.pageStateGate.pageStateProofRef,
    dataQualityFlags: [],
    decisions: {
      privacyDecision: input.privacyGate.decision,
      sourceDecision: input.sourceGate.decision,
      browserSessionDecision: input.browserSessionGate.decision,
      pageStateDecision: input.pageStateGate.decision,
      captureDecision: input.captureRun?.decision ?? { status: "not_applicable", reason: null },
      imageProcessingDecision: input.imageRun?.decision ?? { status: "not_applicable", reason: null },
      artifactDecision: { status: "failed", reason: "missing_output_metadata" },
      outputBoundaryDecision: { status: "not_applicable", reason: null },
    },
  });
}

export async function buildScreenshotArtifactStorageFailure(input: ScreenshotExecutionFailureContext & {
  captureRun: { failure: { message: string } | null; decision: ScreenshotFailureGateDecision } | null;
  imageRun: { failure: { message: string } | null; decision: ScreenshotFailureGateDecision } | null;
  artifactGate: { failure: { message: string } | null; decision: ScreenshotFailureGateDecision };
}): Promise<ScreenshotAbilityResult> {
  return dispatchScreenshotFailureResult({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    status: "failed",
    message: input.artifactGate.failure?.message ?? "Screenshot artifact storage failed.",
    failureReason: input.artifactGate.failure ?? createScreenshotFailure({
      code: "artifact_write_failed",
      message: "Screenshot artifact storage failed.",
    }),
    reviewRequiredReason: null,
    sourceProof: input.sourceGate.sourceProof,
    browserSessionRef: input.browserSessionGate.browserSessionRef,
    pageStateProofRef: input.pageStateGate.pageStateProofRef,
    dataQualityFlags: [],
    decisions: {
      privacyDecision: input.privacyGate.decision,
      sourceDecision: input.sourceGate.decision,
      browserSessionDecision: input.browserSessionGate.decision,
      pageStateDecision: input.pageStateGate.decision,
      captureDecision: input.captureRun?.decision ?? { status: "not_applicable", reason: null },
      imageProcessingDecision: input.imageRun?.decision ?? { status: "not_applicable", reason: null },
      artifactDecision: input.artifactGate.decision,
      outputBoundaryDecision: { status: "not_applicable", reason: null },
    },
  });
}
