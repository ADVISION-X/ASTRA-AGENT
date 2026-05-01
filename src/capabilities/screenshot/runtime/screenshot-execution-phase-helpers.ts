import { runCaptureRunner } from "./capture-runner.js";
import { runImageProcessingRunner } from "./image-processing-runner.js";
import { buildScreenshotCaptureExecutionFailure, buildScreenshotOutputMetadataFailure } from "./screenshot-execution-failure-builders.js";
import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotFailure } from "../contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";
import type {
  ScreenshotExecutionBrowserSessionGateState,
  ScreenshotExecutionGateState,
  ScreenshotExecutionGates,
  ScreenshotExecutionPageStateGateState,
  ScreenshotExecutionSourceGateState,
} from "./screenshot-execution-phases.js";

type ScreenshotOutputMetadata = {
  outputFilePath: string;
  outputWidth: number;
  outputHeight: number;
  mimeType: string;
  createdAt: string;
};

type ScreenshotOutputMetadataResolution =
  | { ok: true; metadata: ScreenshotOutputMetadata }
  | { ok: false; failure: ScreenshotAbilityResult };

type ScreenshotCaptureRun = Awaited<ReturnType<typeof runCaptureRunner>>;
type ScreenshotImageRun = Awaited<ReturnType<typeof runImageProcessingRunner>>;

type ScreenshotOutputMetadataSource = {
  outputFilePath: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  mimeType: string | null;
  createdAt: string;
};

export const resolveScreenshotCaptureRun = async (input: {
  plan: ScreenshotExecutionPlan;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  registryEntry: { maxDurationMs: number };
}) => {
  return input.plan.kind === "capture"
    ? await runCaptureRunner({
        plan: input.plan,
        context: input.context,
        timeoutMs: input.registryEntry.maxDurationMs,
        evidenceId: input.scope.evidenceId,
        createdAt: input.clockStart.startedAt,
      })
    : null;
};

const hasScreenshotPhaseFailure = (input: {
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  executionFailure: ScreenshotFailure | null;
}): boolean => {
  const captureStatus = input.captureRun?.decision.status;
  const imageStatus = input.imageRun?.decision.status;

  return (
    Boolean(input.executionFailure) ||
    (captureStatus !== undefined && captureStatus !== "passed") ||
    (imageStatus !== undefined && imageStatus !== "passed") ||
    (!input.captureRun && !input.imageRun)
  );
};

const resolveScreenshotPhaseFailureStatus = (
  captureStatus: string | undefined,
  imageStatus: string | undefined,
): "review_required" | "failed" =>
  captureStatus === "review_required" || imageStatus === "review_required" ? "review_required" : "failed";

export const resolveScreenshotImageRun = async (input: {
  plan: ScreenshotExecutionPlan;
  context: ScreenshotRuntimeContext;
  registryEntry: { maxDurationMs: number };
}) => {
  return input.plan.kind === "image-processing"
    ? await runImageProcessingRunner({
        plan: input.plan,
        context: input.context,
        timeoutMs: input.registryEntry.maxDurationMs,
      })
    : null;
};

export const resolveScreenshotCaptureAndImagePhaseFailure = async (input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  sourceGate: ScreenshotExecutionSourceGateState;
  browserSessionGate: ScreenshotExecutionBrowserSessionGateState;
  pageStateGate: ScreenshotExecutionPageStateGateState;
  privacyGate: ScreenshotExecutionGateState;
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  executionFailure: ScreenshotFailure | null;
}): Promise<ScreenshotAbilityResult | null> => {
  const captureStatus = input.captureRun?.decision.status;
  const imageStatus = input.imageRun?.decision.status;
  if (!hasScreenshotPhaseFailure(input)) {
    return null;
  }

  const status = resolveScreenshotPhaseFailureStatus(captureStatus, imageStatus);

  return buildScreenshotCaptureExecutionFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    sourceGate: input.sourceGate,
    browserSessionGate: input.browserSessionGate,
    pageStateGate: input.pageStateGate,
    privacyGate: input.privacyGate,
    captureRun: input.captureRun,
    imageRun: input.imageRun,
    executionFailure: input.executionFailure,
    status,
  });
};

const resolveScreenshotOutputMetadataSource = (input: {
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  clockStart: ScreenshotClockStart;
}): ScreenshotOutputMetadataSource =>
  input.captureRun
    ? {
        outputFilePath: input.captureRun.captureResult?.capture.sourceFilePath ?? null,
        outputWidth: input.captureRun.captureResult?.capture.width ?? null,
        outputHeight: input.captureRun.captureResult?.capture.height ?? null,
        mimeType: "image/png",
        createdAt: input.captureRun.captureResult?.capture.createdAt ?? input.clockStart.startedAt,
      }
    : {
        outputFilePath: input.imageRun?.output?.outputFilePath ?? null,
        outputWidth: input.imageRun?.output?.width ?? null,
        outputHeight: input.imageRun?.output?.height ?? null,
        mimeType: input.imageRun?.output?.mimeType ?? null,
        createdAt: input.clockStart.startedAt,
      };

export const resolveScreenshotOutputMetadata = async (input: {
  plan: ScreenshotExecutionPlan;
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
}): Promise<ScreenshotOutputMetadataResolution> => {
  const metadata = resolveScreenshotOutputMetadataSource({
    captureRun: input.captureRun,
    imageRun: input.imageRun,
    clockStart: input.clockStart,
  });

  if (!metadata.outputFilePath || !metadata.outputWidth || !metadata.outputHeight || !metadata.mimeType) {
    return {
      ok: false as const,
      failure: await buildScreenshotOutputMetadataFailure({
        request: input.request,
        context: input.context,
        scope: input.scope,
        clockStart: input.clockStart,
        sourceGate: input.gates.sourceGate,
        browserSessionGate: input.gates.browserSessionGate,
        pageStateGate: input.gates.pageStateGate,
        privacyGate: input.gates.privacyGate,
        captureRun: input.captureRun,
        imageRun: input.imageRun,
      }),
    };
  }

  return {
    ok: true as const,
    metadata: {
      outputFilePath: metadata.outputFilePath,
      outputWidth: metadata.outputWidth,
      outputHeight: metadata.outputHeight,
      mimeType: metadata.mimeType,
      createdAt: metadata.createdAt,
    },
  };
};