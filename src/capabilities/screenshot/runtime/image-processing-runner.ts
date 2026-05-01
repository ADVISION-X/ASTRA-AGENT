import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

function buildImageProcessingFailure(timeout: boolean, detail: string) {
  return {
    decision: { status: timeout ? "review_required" as const : "failed" as const, reason: timeout ? "image_processing_timeout" : "image_processing_failed" },
    output: null,
    failure: createScreenshotFailure({
      code: timeout ? "image_processing_timeout" : "image_processing_failed",
      message: timeout ? "Screenshot image processing timed out." : "Screenshot image processing failed.",
      detail,
    }),
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${timeoutMs}`)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function resolveCaptureRegionProcessing(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "image-processing" }> & { operation: "capture-region" };
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
}) {
  const output = await withTimeout(
    input.context.imageProcessingPort.cropRegion({
      sourceFilePath: input.plan.sourceFilePath,
      region: input.plan.region,
    }).then((result) => ({
      outputFilePath: result.outputFilePath,
      width: result.width,
      height: result.height,
      mimeType: result.mimeType,
      equivalence: null,
      sourceWidth: input.plan.region.width,
      sourceHeight: input.plan.region.height,
      cropOffsetX: input.plan.region.x,
      cropOffsetY: input.plan.region.y,
    })),
    input.timeoutMs,
  );

  return {
    decision: { status: "passed" as const, reason: null },
    output,
    failure: null,
  };
}

async function resolveOptimizeLosslessProcessing(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "image-processing" }> & { operation: "optimize-lossless" };
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
}) {
  const output = await withTimeout(
    input.context.imageProcessingPort.optimizeLossless({
      sourceFilePath: input.plan.sourceFilePath,
    }).then(async (result) => {
      const sourceMeta = await input.context.imageProcessingPort.inspectImage(input.plan.sourceFilePath);
      return {
        outputFilePath: result.outputFilePath,
        width: result.width,
        height: result.height,
        mimeType: result.mimeType,
        equivalence: result.equivalence,
        sourceWidth: sourceMeta.width,
        sourceHeight: sourceMeta.height,
        cropOffsetX: 0,
        cropOffsetY: 0,
      };
    }),
    input.timeoutMs,
  );

  return {
    decision: { status: "passed" as const, reason: null },
    output,
    failure: null,
  };
}

async function resolvePrepareAiInputProcessing(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "image-processing" }> & { operation: "prepare-ai-input" };
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
}) {
  const output = await withTimeout(
    input.context.imageProcessingPort.prepareAiInput({
      sourceFilePath: input.plan.sourceFilePath,
      region: input.plan.region,
      maxAiWidth: input.plan.maxAiWidth,
    }).then((result) => ({
      outputFilePath: result.outputFilePath,
      width: result.width,
      height: result.height,
      mimeType: result.mimeType,
      equivalence: null,
      sourceWidth: result.sourceWidth,
      sourceHeight: result.sourceHeight,
      cropOffsetX: result.cropOffsetX,
      cropOffsetY: result.cropOffsetY,
    })),
    input.timeoutMs,
  );

  return {
    decision: { status: "passed" as const, reason: null },
    output,
    failure: null,
  };
}

async function resolveImageProcessingRunner(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "image-processing" }>;
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
}) {
  switch (input.plan.operation) {
    case "capture-region":
      return resolveCaptureRegionProcessing({
        plan: input.plan,
        context: input.context,
        timeoutMs: input.timeoutMs,
      });
    case "optimize-lossless":
      return resolveOptimizeLosslessProcessing({
        plan: input.plan,
        context: input.context,
        timeoutMs: input.timeoutMs,
      });
    case "prepare-ai-input":
      return resolvePrepareAiInputProcessing({
        plan: input.plan,
        context: input.context,
        timeoutMs: input.timeoutMs,
      });
  }
}

export async function runImageProcessingRunner(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "image-processing" }>;
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
}): Promise<{
  decision: { status: "passed" | "failed" | "review_required"; reason: string | null };
  output:
    | {
        outputFilePath: string;
        width: number;
        height: number;
        mimeType: string;
        equivalence: "dimensions_preserved" | null;
        sourceWidth: number | null;
        sourceHeight: number | null;
        cropOffsetX: number;
        cropOffsetY: number;
      }
    | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  try {
    return await resolveImageProcessingRunner(input);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const timeout = detail.startsWith("timeout:");
    return buildImageProcessingFailure(timeout, detail);
  }
}
