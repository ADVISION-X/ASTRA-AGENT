import type { PrepareAiInputInput, ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../contract.js";

export type PrepareAiInputChildCapability = ScreenshotChildCapability<PrepareAiInputInput>;
export type PrepareAiInputPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing"; operation: "prepare-ai-input" }>;
