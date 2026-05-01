import type { ScreenshotAbilityResult } from "../contract.js";
import { runScreenshotOutputBoundaryGate } from "./screenshot-output-boundary-gate.js";
import {
  buildScreenshotOutputBoundaryFailureResult,
  resolveScreenshotCoordinateSpace,
  resolveScreenshotOutputDimensions,
  resolveScreenshotScaleMapping,
  resolveScreenshotSourceHash,
  resolveScreenshotSuccessOutput,
  type ScreenshotSuccessPathInput,
} from "./screenshot-execution-success-helpers.js";
import { buildScreenshotSuccessResult } from "./screenshot-execution-success-result.js";

async function executeScreenshotSuccessPath(input: ScreenshotSuccessPathInput): Promise<ScreenshotAbilityResult> {
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
    outputBoundaryDecision: outputBoundaryGate.decision,
  });
}

export async function executeScreenshotExecutionSuccess(input: ScreenshotSuccessPathInput): Promise<ScreenshotAbilityResult> {
  return executeScreenshotSuccessPath(input);
}