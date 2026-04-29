import type { CaptureBrowserViewportInput, ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../contract.js";

export type CaptureBrowserViewportChildCapability = ScreenshotChildCapability<CaptureBrowserViewportInput>;
export type CaptureBrowserViewportPlan = Extract<ScreenshotExecutionPlan, { kind: "capture"; operation: "browser-viewport" }>;
