import type { PrepareVisualMissionInput, ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../contract.js";

export type PrepareVisualMissionInputChildCapability = ScreenshotChildCapability<PrepareVisualMissionInput>;
export type PrepareVisualMissionInputPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing"; operation: "prepare-visual-mission-input" }>;