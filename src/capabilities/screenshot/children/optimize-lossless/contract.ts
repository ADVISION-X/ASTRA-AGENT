import type { OptimizeLosslessInput, ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../contract.js";

export type OptimizeLosslessChildCapability = ScreenshotChildCapability<OptimizeLosslessInput>;
export type OptimizeLosslessPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing"; operation: "optimize-lossless" }>;
