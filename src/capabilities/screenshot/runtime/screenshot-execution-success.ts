import type { ScreenshotAbilityResult } from "../contract.js";
import { runScreenshotOutputBoundaryGate } from "./screenshot-output-boundary-gate.js";
import { measureScreenshotPhaseMs } from "./screenshot-clock.js";
import { buildScreenshotOutputBoundaryFailureResult } from "./screenshot-execution-output-boundary-failure.js";
import {
  resolveScreenshotCoordinateSpace,
  resolveScreenshotOutputDimensions,
  resolveScreenshotScaleMapping,
  resolveScreenshotSourceHash,
  resolveScreenshotSuccessOutput,
  type ScreenshotSuccessPathInput,
} from "./screenshot-execution-success-helpers.js";
import { buildScreenshotSuccessResult } from "./screenshot-execution-success-result.js";

async function resolveScreenshotSuccessOutputPayload(input: ScreenshotSuccessPathInput) {
  const sourceHash = await resolveScreenshotSourceHash(input);
  const scaleMapping = resolveScreenshotScaleMapping(input);
  const coordinateSpace = resolveScreenshotCoordinateSpace(input);
  const { outputWidth, outputHeight } = resolveScreenshotOutputDimensions(input);
  const successOutput = resolveScreenshotSuccessOutput({
    pathInput: input,
    sourceHash,
    scaleMapping,
    coordinateSpace,
    outputWidth,
    outputHeight,
  });

  return { sourceHash, scaleMapping, coordinateSpace, outputWidth, outputHeight, successOutput };
}

async function resolveOutputBoundaryMeasurement(input: {
  pathInput: ScreenshotSuccessPathInput;
  successOutput: NonNullable<ScreenshotAbilityResult["output"]>;
}) {
  const outputBoundaryMeasurement = await measureScreenshotPhaseMs({
    clockPort: input.pathInput.context.clockPort,
    invoke: () => runScreenshotOutputBoundaryGate({
      context: input.pathInput.context,
      registryEntry: input.pathInput.registryEntry,
      output: input.successOutput,
    }),
  });

  return {
    outputBoundaryGate: outputBoundaryMeasurement.result,
    pathInputWithTimings: {
      ...input.pathInput,
      phaseTimings: {
        ...input.pathInput.phaseTimings,
        outputBoundaryPhaseMs: outputBoundaryMeasurement.durationMs,
      },
    },
  };
}

async function executeScreenshotSuccessPath(input: ScreenshotSuccessPathInput): Promise<ScreenshotAbilityResult> {
  const successOutputPayload = await resolveScreenshotSuccessOutputPayload(input);
  const { outputBoundaryGate, pathInputWithTimings } = await resolveOutputBoundaryMeasurement({
    pathInput: input,
    successOutput: successOutputPayload.successOutput,
  });

  if (outputBoundaryGate.failure || outputBoundaryGate.decision.status !== "passed") {
    return await buildScreenshotOutputBoundaryFailureResult({
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
    pathInput: pathInputWithTimings,
    sourceHash: successOutputPayload.sourceHash,
    scaleMapping: successOutputPayload.scaleMapping,
    coordinateSpace: successOutputPayload.coordinateSpace,
    outputWidth: successOutputPayload.outputWidth,
    outputHeight: successOutputPayload.outputHeight,
    successOutput: successOutputPayload.successOutput,
    outputBoundaryDecision: outputBoundaryGate.decision,
  });
}

export async function executeScreenshotExecutionSuccess(input: ScreenshotSuccessPathInput): Promise<ScreenshotAbilityResult> {
  return executeScreenshotSuccessPath(input);
}