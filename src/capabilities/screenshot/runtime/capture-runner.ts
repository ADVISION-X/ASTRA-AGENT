import path from "node:path";

import { ScreenshotBrowserCaptureSchema, ScreenshotDesktopCaptureSchema } from "../schema.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotExecutionPlan, ScreenshotRunnerCaptureResult } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

function buildCaptureFailure(detail: string, timeout: boolean) {
  return {
    decision: { status: timeout ? "review_required" as const : "failed" as const, reason: timeout ? "capture_timeout" : "capture_failed" },
    captureResult: null,
    failure: createScreenshotFailure({
      code: timeout ? "capture_timeout" : "capture_failed",
      message: timeout ? "Screenshot capture timed out." : "Screenshot capture failed.",
      detail,
    }),
  };
}

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

async function waitForSampleDelay(input: { delayMs: number | null; abortSignal: AbortSignal }): Promise<void> {
  if (!input.delayMs) {
    return;
  }
  const delayMs = input.delayMs;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    input.abortSignal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(input.abortSignal.reason instanceof Error ? input.abortSignal.reason : new Error("sample delay aborted"));
    }, { once: true });
  });
}

async function runBrowserViewportCapture(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "capture" }> & { operation: "browser-viewport" };
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
}) {
  const captureResult = await runAbortableCapture({
    timeoutMs: input.timeoutMs,
    invoke: async (abortSignal) => {
      await waitForSampleDelay({ delayMs: input.plan.sampleDelayMs, abortSignal });
      return input.context.capturePort.captureBrowserViewport({
        regionLabel: input.plan.regionLabel,
        contentLines: input.plan.contentLines,
        abortSignal,
      });
    },
  });
  ScreenshotBrowserCaptureSchema.parse(captureResult.capture);
  return {
    decision: { status: "passed" as const, reason: null },
    captureResult,
    failure: null,
  };
}

async function runDesktopScreenCapture(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "capture" }> & { operation: "desktop-screen" };
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
  evidenceId: string;
  createdAt: string;
}) {
  const captureResult = await runAbortableCapture({
    timeoutMs: input.timeoutMs,
    invoke: (abortSignal) => input.context.capturePort.captureDesktopScreen({
      screenId: input.plan.screenId,
      outputPath: path.join(input.context.artifactPort.getRootDir(), ".tmp", `${input.evidenceId}.png`),
      createdAt: input.createdAt,
      abortSignal,
    }),
  });
  ScreenshotDesktopCaptureSchema.parse(captureResult.capture);
  return {
    decision: { status: "passed" as const, reason: null },
    captureResult,
    failure: null,
  };
}

async function resolveCaptureRunner(input: {
  plan: Extract<ScreenshotExecutionPlan, { kind: "capture" }>;
  context: ScreenshotRuntimeContext;
  timeoutMs: number;
  evidenceId: string;
  createdAt: string;
}) {
  return input.plan.operation === "browser-viewport"
    ? runBrowserViewportCapture({ plan: input.plan, context: input.context, timeoutMs: input.timeoutMs })
    : runDesktopScreenCapture({ plan: input.plan, context: input.context, timeoutMs: input.timeoutMs, evidenceId: input.evidenceId, createdAt: input.createdAt });
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
    return await resolveCaptureRunner(input);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return buildCaptureFailure(detail, detail.startsWith("timeout:") || detail.includes("AbortError"));
  }
}
