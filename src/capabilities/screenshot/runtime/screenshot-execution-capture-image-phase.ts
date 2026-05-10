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

export async function executeScreenshotCaptureAndImagePhase(input: {
  plan: ScreenshotExecutionPlan;
  gates: ScreenshotExecutionGates;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  registryEntry: ScreenshotChildRegistryEntry;
}): Promise<ScreenshotCaptureImagePhaseSuccess | ScreenshotAbilityResult> {
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
    }),
  });
  const captureRun = captureMeasurement.result;
  const imageRun = imageMeasurement.result;
  const failure = await screenshotExecutionPhaseSupport.resolveScreenshotCaptureAndImagePhaseFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    sourceGate: input.gates.sourceGate,
    browserSessionGate: input.gates.browserSessionGate,
    pageStateGate: input.gates.pageStateGate,
    privacyGate: input.gates.privacyGate,
    captureRun,
    imageRun,
    executionFailure: captureRun?.failure ?? imageRun?.failure ?? null,
  });

  if (failure) {
    return failure;
  }

  return {
    captureRun,
    imageRun,
    phaseTimings: buildPhaseTimings({
      capturePhaseMs: captureMeasurement.durationMs,
      imageProcessingPhaseMs: imageMeasurement.durationMs,
    }),
  };
}