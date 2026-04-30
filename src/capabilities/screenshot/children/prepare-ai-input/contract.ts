import type { PrepareAiInputInput } from "../../contract.js";
import type { ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../runtime/screenshot-child-contract.js";

export type PrepareAiInputChildCapability = ScreenshotChildCapability<PrepareAiInputInput>;
export type PrepareAiInputPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing"; operation: "prepare-ai-input" }>;
