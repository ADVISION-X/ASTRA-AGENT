import type { OptimizeLosslessInput } from "../../contract.js";
import type { ScreenshotChildCapability, ScreenshotExecutionPlan } from "../../runtime/screenshot-child-contract.js";

export type OptimizeLosslessChildCapability = ScreenshotChildCapability<OptimizeLosslessInput>;
export type OptimizeLosslessPlan = Extract<ScreenshotExecutionPlan, { kind: "image-processing"; operation: "optimize-lossless" }>;
