import type { CaptureRegionInput, ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../contract.js";

export type CaptureRegionChildCapability = ScreenshotChildCapability<CaptureRegionInput>;
export type CaptureRegionPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing"; operation: "capture-region" }>;
