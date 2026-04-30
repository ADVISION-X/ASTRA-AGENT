import path from "node:path";

import { ScreenshotBrowserCaptureSchema, ScreenshotDesktopCaptureSchema } from "../schema.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotExecutionPlan, ScreenshotRunnerCaptureResult } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

async function runAbortableCapture<T>(input: {
  timeoutMs: number;
  invoke: (abortSignal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const abortController = new AbortController();
  const timer = setTimeout(() => {
    abortController.abort(new Error(`timeout:${input.timeoutMs}`));
  }, input.timeoutMs);

  try {
    return await input.invoke(abortController.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function runCaptureRunner(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "capture" }>;
  context: ScreenshotRuntimeContext;
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
      const browserViewportPlan = input.plan;
      const captureResult = await runAbortableCapture({
        timeoutMs: input.timeoutMs,
        invoke: (abortSignal) => input.context.capturePort.captureBrowserViewport({
          regionLabel: browserViewportPlan.regionLabel,
          contentLines: browserViewportPlan.contentLines,
          abortSignal,
        }),
      });
      ScreenshotBrowserCaptureSchema.parse(captureResult.capture);
      return {
        decision: { status: "passed", reason: null },
        captureResult,
        failure: null,
      };
    }

    const desktopScreenPlan = input.plan;
    const captureResult = await runAbortableCapture({
      timeoutMs: input.timeoutMs,
      invoke: (abortSignal) => input.context.capturePort.captureDesktopScreen({
        screenId: desktopScreenPlan.screenId,
        outputPath: path.join(input.context.artifactPort.getRootDir(), ".tmp", `${input.evidenceId}.png`),
        createdAt: input.createdAt,
        abortSignal,
      }),
    });
    ScreenshotDesktopCaptureSchema.parse(captureResult.capture);
    return {
      decision: { status: "passed", reason: null },
      captureResult,
      failure: null,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const timeout = detail.startsWith("timeout:") || detail.includes("AbortError");
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
