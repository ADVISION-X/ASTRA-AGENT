import type { ScreenshotAbilityInput } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { projectGridSpecToSourceCoordinates, resolveReadableVisualMissionGridDensity } from "../shared/visual-mission-grid.js";
import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import { resolveScreenshotAiInputEncodeProfile } from "./screenshot-lightweight-observation.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

type PrepareVisualMissionInputPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing" }> & { operation: "prepare-visual-mission-input" };

type ImageProcessingRunnerOutput = {
  outputFilePath: string;
  width: number;
  height: number;
  mimeType: string;
  equivalence: "dimensions_preserved" | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  cropOffsetX: number;
  cropOffsetY: number;
  gridSpec: import("../contract.js").ScreenshotGridSpec | null;
};

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
      gridSpec: null,
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
        gridSpec: null,
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
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
}) {
  const output = await withTimeout(
    input.context.imageProcessingPort.prepareAiInput({
      sourceFilePath: input.plan.sourceFilePath,
      region: input.plan.region,
      maxAiWidth: input.plan.maxAiWidth,
      encodeProfile: resolveScreenshotAiInputEncodeProfile(input.request),
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
      gridSpec: null,
    })),
    input.timeoutMs,
  );

  return {
    decision: { status: "passed" as const, reason: null },
    output,
    failure: null,
  };
}

function resolvePrepareVisualMissionSourceRequirements(plan: PrepareVisualMissionInputPlan) {
  const sourceScreenshotEvidenceId = plan.sourceProof.sourceScreenshotEvidenceId;
  const sourceStorageRef = plan.sourceProof.sourceStorageRef;
  const sourceCoordinateSpace = plan.sourceProof.coordinateSpace;

  if (!sourceScreenshotEvidenceId || !sourceStorageRef || !sourceCoordinateSpace) {
    throw new Error("prepare-visual-mission-input requires sourceProof sourceScreenshotEvidenceId, sourceStorageRef, and coordinateSpace.");
  }

  return { sourceScreenshotEvidenceId, sourceStorageRef, sourceCoordinateSpace };
}

function buildPrepareVisualMissionGridOutput(input: {
  plan: PrepareVisualMissionInputPlan;
  result: {
    outputFilePath: string;
    width: number;
    height: number;
    mimeType: string;
    gridSpec: import("../contract.js").ScreenshotGridSpec;
  };
}): ImageProcessingRunnerOutput {
  return {
    outputFilePath: input.result.outputFilePath,
    width: input.result.width,
    height: input.result.height,
    mimeType: input.result.mimeType,
    equivalence: null,
    sourceWidth: input.result.gridSpec.sourceWidth,
    sourceHeight: input.result.gridSpec.sourceHeight,
    cropOffsetX: 0,
    cropOffsetY: 0,
    gridSpec: projectGridSpecToSourceCoordinates({
      gridSpec: input.result.gridSpec,
      sourceProof: input.plan.sourceProof,
    }),
  };
}

async function resolvePrepareVisualMissionInputProcessing(input: {
  plan: PrepareVisualMissionInputPlan;
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
  createdAt: string;
}) {
  const sourceRequirements = resolvePrepareVisualMissionSourceRequirements(input.plan);
  const sourceMetadata = await input.context.imageProcessingPort.inspectImage(input.plan.sourceFilePath);
  const readableGrid = resolveReadableVisualMissionGridDensity({
    gridImageWidth: sourceMetadata.width,
    gridImageHeight: sourceMetadata.height,
    requestedRowCount: input.plan.rowCount,
    requestedColumnCount: input.plan.columnCount,
  });

  const output = await withTimeout(
    input.context.imageProcessingPort.renderCoordinateGrid({
      sourceFilePath: input.plan.sourceFilePath,
      sourceScreenshotEvidenceId: sourceRequirements.sourceScreenshotEvidenceId,
      sourceStorageRef: sourceRequirements.sourceStorageRef,
      sourceCoordinateSpace: sourceRequirements.sourceCoordinateSpace,
      sourceWidth: input.plan.sourceProof.sourceWidth ?? 0,
      sourceHeight: input.plan.sourceProof.sourceHeight ?? 0,
      rowCount: readableGrid.rowCount,
      columnCount: readableGrid.columnCount,
      axisMode: "y_letters_x_numbers",
      createdAt: input.createdAt,
    }).then((result) => buildPrepareVisualMissionGridOutput({ plan: input.plan, result })),
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
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
  createdAt: string;
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
        request: input.request,
        context: input.context,
        timeoutMs: input.timeoutMs,
      });
    case "prepare-visual-mission-input":
      return resolvePrepareVisualMissionInputProcessing({
        plan: input.plan,
        context: input.context,
        timeoutMs: input.timeoutMs,
        createdAt: input.createdAt,
      });
  }
}

export async function runImageProcessingRunner(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "image-processing" }>;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
  createdAt: string;
}): Promise<{
  decision: { status: "passed" | "failed" | "review_required"; reason: string | null };
  output: ImageProcessingRunnerOutput | null;
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
