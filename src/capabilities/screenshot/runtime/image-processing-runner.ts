import type { ScreenshotAbilityContext, ScreenshotExecutionPlan } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

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

export async function runImageProcessingRunner(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "image-processing" }>;
  context: ScreenshotAbilityContext;
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
    const operation = input.plan.operation;
    const promise = operation === "capture-region"
      ? input.context.imageProcessingPort.cropRegion({
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
        }))
      : operation === "optimize-lossless"
        ? input.context.imageProcessingPort.optimizeLossless({
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
          })
        : input.context.imageProcessingPort.prepareAiInput({
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
          }));

    return {
      decision: { status: "passed", reason: null },
      output: await withTimeout(promise, input.timeoutMs),
      failure: null,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const timeout = detail.startsWith("timeout:");
    return {
      decision: { status: timeout ? "review_required" : "failed", reason: timeout ? "image_processing_timeout" : "image_processing_failed" },
      output: null,
      failure: createScreenshotFailure({
        code: timeout ? "image_processing_timeout" : "image_processing_failed",
        message: timeout ? "Screenshot image processing timed out." : "Screenshot image processing failed.",
        detail,
      }),
    };
  }
}
