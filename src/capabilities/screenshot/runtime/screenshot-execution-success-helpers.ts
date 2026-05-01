import type {
  ScreenshotAbilityInput,
  ScreenshotAbilityResult,
  ScreenshotRuntimeProof,
  ScreenshotScaleMapping,
  ScreenshotSourceProof,
} from "../contract.js";
import { buildDerivedScaleMapping, buildIdentityScaleMapping } from "../shared/screenshot-scale-mapping.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { dispatchScreenshotExecutionFailure, type ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotExecutionPlan, ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import { buildScreenshotSuccessOutput } from "./screenshot-result-builder.js";
import { runArtifactStorageGate } from "./artifact-storage-gate.js";
import { runCaptureRunner } from "./capture-runner.js";
import { runImageProcessingRunner } from "./image-processing-runner.js";

type ScreenshotDecision = ScreenshotRuntimeProof["privacyDecision"];

type ScreenshotGateFailure = {
  message: string;
};

type ScreenshotCaptureRun = Awaited<ReturnType<typeof runCaptureRunner>>;
type ScreenshotImageRun = Awaited<ReturnType<typeof runImageProcessingRunner>>;
type ScreenshotArtifactGate = Awaited<ReturnType<typeof runArtifactStorageGate>>;

type ScreenshotRegionGate = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
};

type ScreenshotOutputBoundaryGate = {
  decision: ScreenshotRuntimeProof["outputBoundaryDecision"];
  failure: ReturnType<typeof createScreenshotFailure> | null;
};

export type ScreenshotSuccessPathInput = {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  clockStart: { startedAt: string; startedMonotonicMs: number };
  scope: ScreenshotExecutionScope;
  gates: {
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
  plan: ScreenshotExecutionPlan;
  regionGate: ScreenshotRegionGate;
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  artifactGate: ScreenshotArtifactGate;
};

type ScreenshotSuccessOutputInput = {
  pathInput: ScreenshotSuccessPathInput;
  sourceHash: string;
  scaleMapping: ScreenshotScaleMapping | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  outputWidth: number | null;
  outputHeight: number | null;
};

const buildScreenshotSuccessOutputIdentityFields = (input: ScreenshotSuccessOutputInput) => ({
  request: input.pathInput.request,
  artifactRef: input.pathInput.artifactGate.artifactRef!,
  evidenceId: input.pathInput.scope.evidenceId,
  pageUrl: input.pathInput.captureRun?.captureResult?.kind === "browser" ? input.pathInput.captureRun.captureResult.capture.pageUrl : null,
  pageTitle: input.pathInput.captureRun?.captureResult?.kind === "browser" ? input.pathInput.captureRun.captureResult.capture.pageTitle : null,
  width: input.outputWidth!,
  height: input.outputHeight!,
  coordinateSpace: input.coordinateSpace!,
  scaleMapping: input.scaleMapping,
  sourceHash: input.sourceHash,
  outputHash: input.pathInput.artifactGate.outputHash!,
});

const resolveScreenshotOriginalDimensions = (input: ScreenshotSuccessOutputInput): { originalWidth: number; originalHeight: number } => ({
  originalWidth: input.pathInput.plan.kind === "capture"
    ? input.outputWidth!
    : input.pathInput.imageRun?.output?.sourceWidth ?? input.pathInput.gates.sourceGate.sourceProof?.sourceWidth ?? input.outputWidth!,
  originalHeight: input.pathInput.plan.kind === "capture"
    ? input.outputHeight!
    : input.pathInput.imageRun?.output?.sourceHeight ?? input.pathInput.gates.sourceGate.sourceProof?.sourceHeight ?? input.outputHeight!,
});

const resolveScreenshotSourceScreenshotEvidenceId = (input: ScreenshotSuccessOutputInput): string | null =>
  input.pathInput.plan.kind === "capture" ? null : input.pathInput.plan.sourceProof.sourceScreenshotEvidenceId;

const resolveScreenshotScreenId = (input: ScreenshotSuccessOutputInput): string | null =>
  input.pathInput.captureRun?.captureResult?.kind === "desktop"
    ? (input.pathInput.captureRun.captureResult.capture.screenId ?? null)
    : input.pathInput.request.source.kind === "desktop_screen"
      ? input.pathInput.request.source.screenId
      : null;

const resolveScreenshotRegionLabel = (input: ScreenshotSuccessOutputInput): string =>
  input.pathInput.plan.kind === "capture"
    ? (input.pathInput.plan.operation === "browser-viewport" ? input.pathInput.plan.regionLabel : input.pathInput.request.purpose)
    : input.pathInput.request.purpose;

const resolveScreenshotRegionType = (input: ScreenshotSuccessOutputInput): string =>
  input.pathInput.plan.kind === "capture"
    ? (input.pathInput.plan.operation === "browser-viewport" ? "viewport" : "desktop-screen")
    : input.pathInput.request.childCapabilityId;

const buildScreenshotSuccessOutputLayoutFields = (input: ScreenshotSuccessOutputInput) => ({
  ...resolveScreenshotOriginalDimensions(input),
  imageKind: input.pathInput.registryEntry.outputImageKind,
  sourceScreenshotEvidenceId: resolveScreenshotSourceScreenshotEvidenceId(input),
  screenId: resolveScreenshotScreenId(input),
  regionLabel: resolveScreenshotRegionLabel(input),
  regionType: resolveScreenshotRegionType(input),
});

const resolveScreenshotSourceHash = async (input: ScreenshotSuccessPathInput): Promise<string> =>
  input.plan.kind === "capture"
    ? input.artifactGate.outputHash!
    : input.gates.sourceGate.sourceProof?.sourceHash ?? await input.context.imageProcessingPort.hashFile(input.plan.sourceFilePath);

const resolveScreenshotScaleMapping = (input: ScreenshotSuccessPathInput): ScreenshotScaleMapping | null =>
  input.plan.kind === "capture"
    ? buildIdentityScaleMapping({
        sourceScreenshotEvidenceId: null,
        sourceStorageRef: input.artifactGate.artifactRef?.storageRef ?? input.scope.fallbackSourceArtifactRef?.storageRef ?? "",
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
  clockStart: ScreenshotSuccessPathInput["clockStart"];
  gates: ScreenshotSuccessPathInput["gates"];
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  outputBoundaryGate: ScreenshotOutputBoundaryGate;
}): Promise<ScreenshotAbilityResult> =>
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

export const resolveScreenshotSuccessOutput = (input: ScreenshotSuccessOutputInput): NonNullable<ScreenshotAbilityResult["output"]> =>
  buildScreenshotSuccessOutput({
    ...buildScreenshotSuccessOutputIdentityFields(input),
    ...buildScreenshotSuccessOutputLayoutFields(input),
  });

export {
  buildScreenshotOutputBoundaryFailureResult,
  resolveScreenshotCoordinateSpace,
  resolveScreenshotOutputDimensions,
  resolveScreenshotScaleMapping,
  resolveScreenshotSourceHash,
};