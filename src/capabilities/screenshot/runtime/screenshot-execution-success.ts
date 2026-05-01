import { createHash } from "node:crypto";

import type {
  ScreenshotAbilityInput,
  ScreenshotAbilityResult,
  ScreenshotRuntimeProof,
  ScreenshotScaleMapping,
  ScreenshotSourceProof,
} from "../contract.js";
import { buildDerivedScaleMapping, buildIdentityScaleMapping } from "../shared/screenshot-scale-mapping.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { runScreenshotOutputBoundaryGate } from "./screenshot-output-boundary-gate.js";
import { buildScreenshotRuntimeProof } from "./screenshot-proof-builder.js";
import { buildScreenshotResult, buildScreenshotSuccessOutput } from "./screenshot-result-builder.js";
import { dispatchScreenshotExecutionFailure, type ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import { finishScreenshotClock } from "./screenshot-clock.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotExecutionPlan, ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";

function buildRef(prefix: string, input: string): string {
  return `${prefix}:${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

type ScreenshotDecision = ScreenshotRuntimeProof["privacyDecision"];

type ScreenshotGateFailure = {
  message: string;
};

type ScreenshotExecutionGates = {
  sourceGate: {
    failure: ScreenshotGateFailure | null;
    decision: ScreenshotDecision;
    sourceProof: ScreenshotSourceProof | null;
  };
  browserSessionGate: {
    decision: ScreenshotDecision;
    browserSessionRef: string | null;
  };
  pageStateGate: {
    decision: ScreenshotDecision;
    pageStateProofRef: string | null;
  };
  privacyGate: {
    decision: ScreenshotDecision;
  };
};

type ScreenshotRegionGate = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
};

type ScreenshotCaptureRun = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
  captureResult?: {
    kind: string;
    capture: {
      sourceFilePath?: string | null;
      width?: number | null;
      height?: number | null;
      createdAt?: string | null;
      pageUrl?: string | null;
      pageTitle?: string | null;
      screenId?: string | null;
    };
  } | null;
};

type ScreenshotImageRun = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
  output?: {
    outputFilePath?: string | null;
    width?: number | null;
    height?: number | null;
    mimeType?: string | null;
    sourceWidth?: number | null;
    sourceHeight?: number | null;
    cropOffsetX?: number | null;
    cropOffsetY?: number | null;
  };
};

type ScreenshotArtifactGate = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
  artifactRef: { storageRef: string } | null;
  outputHash: string | null;
};

type ScreenshotSuccessPathInput = {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  clockStart: ScreenshotClockStart;
  scope: ScreenshotExecutionScope;
  gates: ScreenshotExecutionGates;
  plan: ScreenshotExecutionPlan;
  regionGate: ScreenshotRegionGate;
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  artifactGate: ScreenshotArtifactGate;
};

type ScreenshotSuccessPathFailureGate = Awaited<ReturnType<typeof runScreenshotOutputBoundaryGate>>;

type ScreenshotSuccessClockFinish = ReturnType<typeof finishScreenshotClock>;

const resolveScreenshotSourceHash = async (input: ScreenshotSuccessPathInput): Promise<string> =>
  input.plan.kind === "capture"
    ? input.artifactGate.outputHash ?? ""
    : input.gates.sourceGate.sourceProof?.sourceHash ?? await input.context.imageProcessingPort.hashFile(input.plan.sourceFilePath);

const resolveScreenshotScaleMapping = (input: ScreenshotSuccessPathInput): ScreenshotScaleMapping | null =>
  input.plan.kind === "capture"
    ? buildIdentityScaleMapping({
        sourceScreenshotEvidenceId: null,
        sourceStorageRef: input.artifactGate.artifactRef?.storageRef ?? input.scope.fallbackSourceArtifactRef ?? "",
        sourceCoordinateSpace: input.registryEntry.coordinateSpacePolicy === "desktop_screen_pixels" ? "desktop_screen_pixels" : "browser_viewport_pixels",
        sourceWidth: input.captureRun?.captureResult?.capture.width ?? input.imageRun?.output?.sourceWidth ?? 0,
        sourceHeight: input.captureRun?.captureResult?.capture.height ?? input.imageRun?.output?.sourceHeight ?? 0,
      })
    : input.plan.operation === "prepare-ai-input"
      ? buildDerivedScaleMapping({
          sourceScreenshotEvidenceId: input.plan.sourceProof.sourceScreenshotEvidenceId,
          sourceStorageRef: input.plan.sourceProof.sourceStorageRef,
          sourceCoordinateSpace: input.plan.sourceProof.coordinateSpace ?? "source_image_pixels",
          targetCoordinateSpace: "ai_input_pixels",
          sourceWidth: input.imageRun?.output?.sourceWidth ?? input.captureRun?.captureResult?.capture.width ?? 0,
          sourceHeight: input.imageRun?.output?.sourceHeight ?? input.captureRun?.captureResult?.capture.height ?? 0,
          targetWidth: input.imageRun?.output?.width ?? input.captureRun?.captureResult?.capture.width ?? 0,
          targetHeight: input.imageRun?.output?.height ?? input.captureRun?.captureResult?.capture.height ?? 0,
          cropOffsetX: input.imageRun?.output?.cropOffsetX ?? 0,
          cropOffsetY: input.imageRun?.output?.cropOffsetY ?? 0,
        })
      : buildIdentityScaleMapping({
          sourceScreenshotEvidenceId: input.plan.sourceProof.sourceScreenshotEvidenceId,
          sourceStorageRef: input.plan.sourceProof.sourceStorageRef,
          sourceCoordinateSpace: input.plan.sourceProof.coordinateSpace ?? "source_image_pixels",
          sourceWidth: input.imageRun?.output?.sourceWidth ?? input.captureRun?.captureResult?.capture.width ?? 0,
          sourceHeight: input.imageRun?.output?.sourceHeight ?? input.captureRun?.captureResult?.capture.height ?? 0,
        });

const resolveScreenshotCoordinateSpace = (input: ScreenshotSuccessPathInput): ScreenshotRuntimeProof["coordinateSpace"] =>
  input.plan.kind === "capture"
    ? (input.registryEntry.coordinateSpacePolicy as "browser_viewport_pixels" | "desktop_screen_pixels")
    : input.plan.operation === "prepare-ai-input"
      ? "ai_input_pixels"
      : "source_image_pixels";

const resolveScreenshotOutputDimensions = (input: ScreenshotSuccessPathInput): { outputWidth: number | null; outputHeight: number | null } => ({
  outputWidth: input.captureRun?.captureResult?.capture.width ?? input.imageRun?.output?.width ?? null,
  outputHeight: input.captureRun?.captureResult?.capture.height ?? input.imageRun?.output?.height ?? null,
});

const buildScreenshotOutputBoundaryFailureResult = (input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  outputBoundaryGate: ScreenshotSuccessPathFailureGate;
}): ScreenshotAbilityResult =>
  dispatchScreenshotExecutionFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    status: "failed",
    message: input.outputBoundaryGate.failure?.message ?? "Screenshot output boundary validation failed.",
    failureReason: input.outputBoundaryGate.failure ?? createScreenshotFailure({
      code: "output_schema_invalid",
      message: "Screenshot output boundary validation failed.",
    }),
    reviewRequiredReason: null,
    startedAt: input.clockStart.startedAt,
    startedMonotonicMs: input.clockStart.startedMonotonicMs,
    sourceProof: input.gates.sourceGate.sourceProof,
    browserSessionRef: input.gates.browserSessionGate.browserSessionRef,
    pageStateProofRef: input.gates.pageStateGate.pageStateProofRef,
    dataQualityFlags: [],
    decisions: {
      privacyDecision: input.gates.privacyGate.decision,
      sourceDecision: input.gates.sourceGate.decision,
      browserSessionDecision: input.gates.browserSessionGate.decision,
      pageStateDecision: input.gates.pageStateGate.decision,
      captureDecision: input.captureRun?.decision ?? { status: "not_applicable", reason: null },
      imageProcessingDecision: input.imageRun?.decision ?? { status: "not_applicable", reason: null },
      artifactDecision: input.outputBoundaryGate.decision,
      outputBoundaryDecision: input.outputBoundaryGate.decision,
    },
  });

const buildScreenshotSuccessDataQualityFlags = (input: ScreenshotSuccessPathInput): ScreenshotRuntimeProof["dataQualityFlags"] => [
  "artifact_persisted",
  input.plan.kind === "capture" ? "capture_fresh" : "scale_mapping_verified",
  input.gates.browserSessionGate.decision.status === "passed" ? "browser_session_verified" : null,
  input.gates.pageStateGate.pageStateProofRef ? "page_state_verified" : "page_state_unverified",
  input.regionGate.decision.status === "passed" ? "region_proof_verified" : null,
  input.plan.kind === "image-processing" && input.plan.operation === "optimize-lossless" ? "lossless_equivalence_verified" : null,
  input.request.childCapabilityId === "capture-desktop-screen" ? "desktop_capture_requested" : null,
].filter((value): value is ScreenshotRuntimeProof["dataQualityFlags"][number] => value !== null);

const buildScreenshotSuccessRuntimeProof = (input: {
  pathInput: ScreenshotSuccessPathInput;
  finished: ScreenshotSuccessClockFinish;
  sourceHash: string;
  scaleMapping: ScreenshotScaleMapping | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  outputWidth: number | null;
  outputHeight: number | null;
  dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"];
  outputBoundaryDecision: ScreenshotSuccessPathFailureGate["decision"];
}): ScreenshotRuntimeProof =>
  buildScreenshotRuntimeProof({
    request: input.pathInput.request,
    proofId: buildRef("screenshot-proof", `${input.pathInput.scope.inputRef}:${input.pathInput.scope.idempotencyKey}:success`),
    runId: input.pathInput.scope.runId,
    missionId: input.pathInput.scope.missionId,
    inputRef: input.pathInput.scope.inputRef,
    outputRef: input.pathInput.scope.outputRef,
    idempotencyKey: input.pathInput.scope.idempotencyKey,
    startedAt: input.pathInput.clockStart.startedAt,
    endedAt: input.finished.endedAt,
    durationMs: input.finished.durationMs,
    startedMonotonicMs: input.pathInput.clockStart.startedMonotonicMs,
    endedMonotonicMs: input.finished.endedMonotonicMs,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    sourceProof: input.pathInput.gates.sourceGate.sourceProof,
    artifactRef: input.pathInput.artifactGate.artifactRef,
    sourceArtifactRef: input.pathInput.scope.fallbackSourceArtifactRef,
    sourceHash: input.sourceHash,
    outputHash: input.pathInput.artifactGate.outputHash,
    sourceWidth: input.pathInput.plan.kind === "capture" ? input.outputWidth : (input.pathInput.imageRun?.output?.sourceWidth ?? input.pathInput.gates.sourceGate.sourceProof?.sourceWidth ?? null),
    sourceHeight: input.pathInput.plan.kind === "capture" ? input.outputHeight : (input.pathInput.imageRun?.output?.sourceHeight ?? input.pathInput.gates.sourceGate.sourceProof?.sourceHeight ?? null),
    outputWidth: input.outputWidth,
    outputHeight: input.outputHeight,
    coordinateSpace: input.coordinateSpace,
    scaleMapping: input.scaleMapping,
    browserSessionRef: input.pathInput.gates.browserSessionGate.browserSessionRef,
    pageStateProofRef: input.pathInput.gates.pageStateGate.pageStateProofRef,
    screenshotEvidenceId: input.pathInput.scope.evidenceId,
    decisions: {
      privacyDecision: input.pathInput.gates.privacyGate.decision,
      sourceDecision: input.pathInput.gates.sourceGate.decision,
      browserSessionDecision: input.pathInput.gates.browserSessionGate.decision,
      pageStateDecision: input.pathInput.gates.pageStateGate.decision,
      captureDecision: input.pathInput.captureRun?.decision ?? { status: "not_applicable", reason: null },
      imageProcessingDecision: input.pathInput.imageRun?.decision ?? { status: "not_applicable", reason: null },
      artifactDecision: input.pathInput.artifactGate.decision,
      outputBoundaryDecision: input.outputBoundaryDecision,
    },
    dataQualityFlags: input.dataQualityFlags,
  });

const buildScreenshotSuccessResult = async (input: {
  pathInput: ScreenshotSuccessPathInput;
  sourceHash: string;
  scaleMapping: ScreenshotScaleMapping | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  outputWidth: number | null;
  outputHeight: number | null;
  successOutput: ReturnType<typeof buildScreenshotSuccessOutput>;
  outputBoundaryGate: ScreenshotSuccessPathFailureGate;
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
    outputBoundaryDecision: input.outputBoundaryGate.decision,
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

async function executeScreenshotSuccessPath(input: ScreenshotSuccessPathInput): Promise<ScreenshotAbilityResult> {
  const sourceHash = await resolveScreenshotSourceHash(input);
  const scaleMapping = resolveScreenshotScaleMapping(input);
  const coordinateSpace = resolveScreenshotCoordinateSpace(input);
  const { outputWidth, outputHeight } = resolveScreenshotOutputDimensions(input);
  const successOutput = buildScreenshotSuccessOutput({
    request: input.request,
    artifactRef: input.artifactGate.artifactRef!,
    evidenceId: input.scope.evidenceId,
    pageUrl: input.captureRun?.captureResult?.kind === "browser" ? input.captureRun.captureResult.capture.pageUrl : null,
    pageTitle: input.captureRun?.captureResult?.kind === "browser" ? input.captureRun.captureResult.capture.pageTitle : null,
    width: outputWidth,
    height: outputHeight,
    originalWidth: input.plan.kind === "capture"
      ? outputWidth
      : input.imageRun?.output?.sourceWidth ?? input.gates.sourceGate.sourceProof?.sourceWidth ?? outputWidth,
    originalHeight: input.plan.kind === "capture"
      ? outputHeight
      : input.imageRun?.output?.sourceHeight ?? input.gates.sourceGate.sourceProof?.sourceHeight ?? outputHeight,
    imageKind: input.registryEntry.outputImageKind,
    coordinateSpace,
    scaleMapping,
    sourceScreenshotEvidenceId: input.plan.kind === "capture" ? null : input.plan.sourceProof.sourceScreenshotEvidenceId,
    screenId: input.captureRun?.captureResult?.kind === "desktop" ? input.captureRun.captureResult.capture.screenId : (input.request.source.kind === "desktop_screen" ? input.request.source.screenId : null),
    sourceHash,
    outputHash: input.artifactGate.outputHash,
    regionLabel: input.plan.kind === "capture"
      ? (input.plan.operation === "browser-viewport" ? input.plan.regionLabel : input.request.purpose)
      : input.request.purpose,
    regionType: input.plan.kind === "capture"
      ? (input.plan.operation === "browser-viewport" ? "viewport" : "desktop-screen")
      : input.request.childCapabilityId,
  });

  const outputBoundaryGate = await runScreenshotOutputBoundaryGate({
    context: input.context,
    registryEntry: input.registryEntry,
    output: successOutput,
  });
  if (outputBoundaryGate.failure || outputBoundaryGate.decision.status !== "passed") {
    return buildScreenshotOutputBoundaryFailureResult({
      request: input.request,
      context: input.context,
      scope: input.scope,
      clockStart: input.clockStart,
      gates: input.gates,
      captureRun: input.captureRun,
      imageRun: input.imageRun,
      outputBoundaryGate,
    });
  }

  return buildScreenshotSuccessResult({
    pathInput: input,
    sourceHash,
    scaleMapping,
    coordinateSpace,
    outputWidth,
    outputHeight,
    successOutput,
    outputBoundaryGate,
  });
}

export async function executeScreenshotExecutionSuccess(input: ScreenshotSuccessPathInput): Promise<ScreenshotAbilityResult> {
  return executeScreenshotSuccessPath(input);
}
