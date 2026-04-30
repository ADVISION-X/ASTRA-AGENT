import type { CaptureRegionInput } from "../../contract.js";
import type { ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../runtime/screenshot-child-contract.js";

export type CaptureRegionChildCapability = ScreenshotChildCapability<CaptureRegionInput>;
export type CaptureRegionPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing"; operation: "capture-region" }>;
