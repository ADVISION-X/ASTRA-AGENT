import type { ScreenshotAbilityInput, ScreenshotAbilityResult } from "../contract.js";
import { EMPTY_SCREENSHOT_PHASE_TIMINGS, measureScreenshotPhaseMs, type ScreenshotClockStart, type ScreenshotPhaseTimings } from "./screenshot-clock.js";
import type { ScreenshotChildRegistryEntry, ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import { screenshotExecutionPhaseSupport } from "./screenshot-execution-phase-support.js";
import { screenshotExecutionRuntimeSupport } from "./screenshot-execution-runtime-support.js";
import type { ScreenshotExecutionGates } from "./screenshot-execution-phases.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

type ScreenshotCaptureMeasurement = Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runCaptureRunner>> | null;
type ScreenshotImageMeasurement = Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runImageProcessingRunner>> | null;

type ScreenshotCaptureImagePhaseSuccess = {
  captureRun: ScreenshotCaptureMeasurement;
  imageRun: ScreenshotImageMeasurement;
  phaseTimings: ScreenshotPhaseTimings;
};

type ScreenshotCaptureImagePhaseMeasurements = {
  captureMeasurement: Awaited<ReturnType<typeof measureOptionalScreenshotPhase<ScreenshotCaptureMeasurement>>>;
  imageMeasurement: Awaited<ReturnType<typeof measureOptionalScreenshotPhase<ScreenshotImageMeasurement>>>;
  captureRun: ScreenshotCaptureMeasurement;
  imageRun: ScreenshotImageMeasurement;
};

async function measureOptionalScreenshotPhase<T>(input: {
  enabled: boolean;
  context: ScreenshotRuntimeContext;
  invoke: () => Promise<T>;
}): Promise<{ result: T | null; durationMs: number | null }> {
  if (!input.enabled) {
    return { result: null, durationMs: null };
  }

  const measurement = await measureScreenshotPhaseMs({
    clockPort: input.context.clockPort,
    invoke: input.invoke,
  });

  return {
    result: measurement.result,
    durationMs: measurement.durationMs,
  };
}

function buildPhaseTimings(input: {
  capturePhaseMs: number | null;
  imageProcessingPhaseMs: number | null;
}): ScreenshotPhaseTimings {
  return {
    ...EMPTY_SCREENSHOT_PHASE_TIMINGS,
    capturePhaseMs: input.capturePhaseMs,
    imageProcessingPhaseMs: input.imageProcessingPhaseMs,
  };
}

async function resolveCaptureImageMeasurements(input: {
  plan: ScreenshotExecutionPlan;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  registryEntry: ScreenshotChildRegistryEntry;
}): Promise<ScreenshotCaptureImagePhaseMeasurements> {
  const captureMeasurement = await measureOptionalScreenshotPhase({
    enabled: input.plan.kind === "capture",
    context: input.context,
    invoke: () => screenshotExecutionPhaseSupport.resolveScreenshotCaptureRun(input),
  });
  const imageMeasurement = await measureOptionalScreenshotPhase({
    enabled: input.plan.kind === "image-processing",
    context: input.context,
    invoke: () => screenshotExecutionPhaseSupport.resolveScreenshotImageRun({
      plan: input.plan,
      context: input.context,
      request: input.request,
      registryEntry: input.registryEntry,
      createdAt: input.clockStart.startedAt,
    }),
  });
  return {
    captureMeasurement,
    imageMeasurement,
    captureRun: captureMeasurement.result,
    imageRun: imageMeasurement.result,
  };
}

async function resolveCaptureImageFailure(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
  measurements: ScreenshotCaptureImagePhaseMeasurements;
}) {
  return screenshotExecutionPhaseSupport.resolveScreenshotCaptureAndImagePhaseFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    sourceGate: input.gates.sourceGate,
    browserSessionGate: input.gates.browserSessionGate,
    pageStateGate: input.gates.pageStateGate,
    privacyGate: input.gates.privacyGate,
    captureRun: input.measurements.captureRun,
    imageRun: input.measurements.imageRun,
    executionFailure: input.measurements.captureRun?.failure ?? input.measurements.imageRun?.failure ?? null,
  });
}

function buildCaptureImagePhaseSuccess(measurements: ScreenshotCaptureImagePhaseMeasurements): ScreenshotCaptureImagePhaseSuccess {
  const { captureMeasurement, imageMeasurement, captureRun, imageRun } = measurements;
  return {
    captureRun,
    imageRun,
    phaseTimings: buildPhaseTimings({
      capturePhaseMs: captureMeasurement.durationMs,
      imageProcessingPhaseMs: imageMeasurement.durationMs,
    }),
  };
}

export async function executeScreenshotCaptureAndImagePhase(input: {
  plan: ScreenshotExecutionPlan;
  gates: ScreenshotExecutionGates;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  registryEntry: ScreenshotChildRegistryEntry;
}): Promise<ScreenshotCaptureImagePhaseSuccess | ScreenshotAbilityResult> {
  const measurements = await resolveCaptureImageMeasurements(input);
  const failure = await resolveCaptureImageFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    gates: input.gates,
    measurements,
  });

  if (failure) {
    return failure;
  }

  return buildCaptureImagePhaseSuccess(measurements);
}