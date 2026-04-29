import type { CaptureDesktopScreenInput, ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../contract.js";

export type CaptureDesktopScreenChildCapability = ScreenshotChildCapability<CaptureDesktopScreenInput>;
export type CaptureDesktopScreenPlan = Extract<ScreenshotExecutionPlan, { kind: "capture"; operation: "desktop-screen" }>;
