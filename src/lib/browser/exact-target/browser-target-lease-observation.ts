import { randomUUID } from "node:crypto";

import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserGeometrySnapshot,
  BrowserTargetLease,
} from "../browser-authority-api.js";
import type {
  BrowserWireCommand,
  BrowserWireTargetDescriptor,
} from "../protocol/generated/browser-protocol.js";
import type { BrowserArtifactReceipt } from "./browser-artifact-stream.js";
import type { BrowserMutationClass } from "./browser-command-contract.js";
import type { ControlledBrowserTarget } from "./browser-target-ref.js";

export type BrowserTargetLeaseObservationPort = Readonly<{
  rawTabId(): number;
  requireTarget(): ControlledBrowserTarget;
  ensureTarget(): Promise<ControlledBrowserTarget>;
  descriptorFor(target: ControlledBrowserTarget): BrowserWireTargetDescriptor;
  updateDocument(
    target: ControlledBrowserTarget,
    descriptor: BrowserWireTargetDescriptor,
  ): ControlledBrowserTarget;
  forgetTargetForRecovery(): void;
  command<T>(
    command: BrowserWireCommand,
    mutationClass: BrowserMutationClass,
    abortSignal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<{ commandId: string; result: T }>;
  defaultAbortSignal(): AbortSignal | undefined;
  assertValid(): void;
  action(id: string, message: string, started: number): BrowserActionResult;
}>;

export const captureBrowserTargetScreenshot = async (
  port: BrowserTargetLeaseObservationPort,
  input: Parameters<BrowserTargetLease["screenshotRegion"]>[0],
): Promise<BrowserCaptureResult> => {
  const started = Date.now();
  const result = await port.command<{
    artifactReceipt: BrowserArtifactReceipt;
  }>(
    { kind: "screenshot_target", tabId: port.rawTabId() },
    "observation",
    input.abortSignal ?? port.defaultAbortSignal(),
    30_000,
  );
  const target = port.requireTarget();
  const descriptor = port.descriptorFor(target);
  return {
    browserActionId: `browser-capture:${randomUUID()}`,
    pageUrl: descriptor.url,
    pageTitle: descriptor.title,
    regionLabel: input.regionLabel,
    regionType: "viewport",
    width: descriptor.viewportWidth,
    height: descriptor.viewportHeight,
    viewportWidth: descriptor.viewportWidth,
    viewportHeight: descriptor.viewportHeight,
    ...(input.contentLines ? { contentLines: input.contentLines } : {}),
    sourceFilePath: result.result.artifactReceipt.filePath,
    createdAt: new Date(started).toISOString(),
    targetRef: target.targetRef,
    documentRef: target.documentRef,
  };
};

export const readBrowserTargetGeometry = async (
  port: BrowserTargetLeaseObservationPort,
  abortSignal?: AbortSignal,
): Promise<BrowserGeometrySnapshot> => {
  const target = await port.ensureTarget();
  const entry = port.descriptorFor(target);
  let descriptor: BrowserWireTargetDescriptor;
  try {
    descriptor = (
      await port.command<BrowserWireTargetDescriptor>(
        { kind: "inspect_target", tabId: entry.tabId },
        "observation",
        abortSignal ?? port.defaultAbortSignal(),
      )
    ).result;
  } catch (error) {
    if (isRecoverableTargetError(error)) port.forgetTargetForRecovery();
    throw error;
  }
  const current = port.updateDocument(target, descriptor);
  return geometryFromDescriptor(current, descriptor);
};

export const waitForBrowserTarget = async (
  port: BrowserTargetLeaseObservationPort,
  durationMs: number,
  abortSignal?: AbortSignal,
): Promise<BrowserActionResult> => {
  port.assertValid();
  const signal = abortSignal ?? port.defaultAbortSignal();
  const started = Date.now();
  await waitForDuration(durationMs, signal);
  port.assertValid();
  return port.action(
    `browser-wait:${randomUUID()}`,
    `waited ${durationMs}ms`,
    started,
  );
};

const waitForDuration = (
  durationMs: number,
  signal?: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, durationMs);
    const abort = () => {
      clearTimeout(timer);
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new Error("browser wait aborted"),
      );
    };
    signal?.addEventListener("abort", abort, { once: true });
  });

const geometryFromDescriptor = (
  target: ControlledBrowserTarget,
  descriptor: BrowserWireTargetDescriptor,
): BrowserGeometrySnapshot => ({
  windowX: 0,
  windowY: 0,
  viewportWidth: descriptor.viewportWidth,
  viewportHeight: descriptor.viewportHeight,
  screenshotWidth: Math.round(
    descriptor.viewportWidth * descriptor.deviceScaleFactor,
  ),
  screenshotHeight: Math.round(
    descriptor.viewportHeight * descriptor.deviceScaleFactor,
  ),
  scaleFactor: descriptor.deviceScaleFactor,
  currentUrl: descriptor.url,
  pageTitle: descriptor.title,
  visibleContentBounds: {
    x: 0,
    y: 0,
    width: descriptor.viewportWidth,
    height: descriptor.viewportHeight,
  },
  capturedAt: new Date().toISOString(),
  targetRef: target.targetRef,
  documentRef: target.documentRef,
});

const isRecoverableTargetError = (error: unknown): boolean =>
  /(?:DEVTOOLS_ATTACHMENT_CONFLICT|TARGET_NOT_FOUND).*No tab with given id/iu.test(
    error instanceof Error ? error.message : String(error),
  );
