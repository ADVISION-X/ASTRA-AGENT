import type { CaptureBrowserViewportInput } from "../../contract.js";
import type { ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../runtime/screenshot-child-contract.js";

export type CaptureBrowserViewportChildCapability = ScreenshotChildCapability<CaptureBrowserViewportInput>;
export type CaptureBrowserViewportPlan = Extract<ScreenshotExecutionPlan, { kind: "capture"; operation: "browser-viewport" }>;
