import type { PrepareVisualMissionInput } from "../../contract.js";
import type { ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../runtime/screenshot-child-contract.js";

export type PrepareVisualMissionInputChildCapability = ScreenshotChildCapability<PrepareVisualMissionInput>;
export type PrepareVisualMissionInputPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing"; operation: "prepare-visual-mission-input" }>;