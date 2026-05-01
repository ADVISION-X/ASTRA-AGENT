import { runCaptureRunner } from "./capture-runner.js";
import { runImageProcessingRunner } from "./image-processing-runner.js";
import { buildScreenshotCaptureExecutionFailure, buildScreenshotOutputMetadataFailure } from "./screenshot-execution-failure-builders.js";
import type { ScreenshotAbilityInput, ScreenshotAbilityResult } from "../contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";
import type { ScreenshotExecutionBrowserSessionGateState, ScreenshotExecutionGateState, ScreenshotExecutionGates, ScreenshotExecutionPageStateGateState, ScreenshotExecutionSourceGateState } from "./screenshot-execution-phases.js";

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
        createdAt: input.context.clockPort.nowIso(),
      })
    : null;
};

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

export const resolveScreenshotCaptureAndImagePhaseFailure = (input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  sourceGate: ScreenshotExecutionSourceGateState;
  browserSessionGate: ScreenshotExecutionBrowserSessionGateState;
  pageStateGate: ScreenshotExecutionPageStateGateState;
  privacyGate: ScreenshotExecutionGateState;
  captureRun: Awaited<ReturnType<typeof runCaptureRunner>> | null;
  imageRun: Awaited<ReturnType<typeof runImageProcessingRunner>> | null;
  executionFailure: { message: string } | null;
}): ScreenshotAbilityResult | null => {
  const captureStatus = input.captureRun?.decision.status;
  const imageStatus = input.imageRun?.decision.status;
  const hasFailedRun = Boolean(input.executionFailure)
    || captureStatus !== undefined && captureStatus !== "passed"
    || imageStatus !== undefined && imageStatus !== "passed"
    || (!input.captureRun && !input.imageRun);

  if (!hasFailedRun) {
    return null;
  }

  const status = captureStatus === "review_required" || imageStatus === "review_required"
    ? "review_required"
    : "failed";

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

export const resolveScreenshotOutputMetadata = (input: {
  plan: ScreenshotExecutionPlan;
  captureRun: Awaited<ReturnType<typeof runCaptureRunner>> | null;
  imageRun: Awaited<ReturnType<typeof runImageProcessingRunner>> | null;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
}): ScreenshotOutputMetadataResolution => {
  const outputFilePath = input.captureRun
    ? input.captureRun.captureResult?.capture.sourceFilePath ?? null
    : input.imageRun?.output?.outputFilePath ?? null;
  const outputWidth = input.captureRun
    ? input.captureRun.captureResult?.capture.width ?? null
    : input.imageRun?.output?.width ?? null;
  const outputHeight = input.captureRun
    ? input.captureRun.captureResult?.capture.height ?? null
    : input.imageRun?.output?.height ?? null;
  const mimeType = input.captureRun
    ? "image/png"
    : input.imageRun?.output?.mimeType ?? null;
  const createdAt = input.captureRun
    ? input.captureRun.captureResult?.capture.createdAt ?? input.clockStart.startedAt
    : input.clockStart.startedAt;

  if (!outputFilePath || !outputWidth || !outputHeight || !mimeType) {
    return {
      ok: false as const,
      failure: buildScreenshotOutputMetadataFailure({
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
      outputFilePath,
      outputWidth,
      outputHeight,
      mimeType,
      createdAt,
    },
  };
};