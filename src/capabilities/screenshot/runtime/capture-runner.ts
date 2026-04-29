import path from "node:path";

import { ScreenshotBrowserCaptureSchema, ScreenshotDesktopCaptureSchema } from "../schema.js";
import type { ScreenshotAbilityContext, ScreenshotExecutionPlan, ScreenshotRunnerCaptureResult } from "../contract.js";
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

export async function runCaptureRunner(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "capture" }>;
  context: ScreenshotAbilityContext;
  timeoutMs: number;
  evidenceId: string;
  createdAt: string;
}): Promise<{
  decision: { status: "passed" | "failed" | "review_required"; reason: string | null };
  captureResult: ScreenshotRunnerCaptureResult | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  try {
    if (input.plan.operation === "browser-viewport") {
      const captureResult = await withTimeout(
        input.context.capturePort.captureBrowserViewport({
          regionLabel: input.plan.regionLabel,
          contentLines: input.plan.contentLines,
        }),
        input.timeoutMs,
      );
      ScreenshotBrowserCaptureSchema.parse(captureResult.capture);
      return {
        decision: { status: "passed", reason: null },
        captureResult,
        failure: null,
      };
    }

    const captureResult = await withTimeout(
      input.context.capturePort.captureDesktopScreen({
        screenId: input.plan.screenId,
        outputPath: path.join(input.context.artifactPort.getRootDir(), ".tmp", `${input.evidenceId}.png`),
        createdAt: input.createdAt,
      }),
      input.timeoutMs,
    );
    ScreenshotDesktopCaptureSchema.parse(captureResult.capture);
    return {
      decision: { status: "passed", reason: null },
      captureResult,
      failure: null,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const timeout = detail.startsWith("timeout:");
    return {
      decision: { status: timeout ? "review_required" : "failed", reason: timeout ? "capture_timeout" : "capture_failed" },
      captureResult: null,
      failure: createScreenshotFailure({
        code: timeout ? "capture_timeout" : "capture_failed",
        message: timeout ? "Screenshot capture timed out." : "Screenshot capture failed.",
        detail,
      }),
    };
  }
}
