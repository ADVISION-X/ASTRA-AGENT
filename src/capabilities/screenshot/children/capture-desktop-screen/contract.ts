import type { CaptureDesktopScreenInput } from "../../contract.js";
import type { ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../runtime/screenshot-child-contract.js";

export type CaptureDesktopScreenChildCapability = ScreenshotChildCapability<CaptureDesktopScreenInput>;
export type CaptureDesktopScreenPlan = Extract<ScreenshotExecutionPlan, { kind: "capture"; operation: "desktop-screen" }>;
