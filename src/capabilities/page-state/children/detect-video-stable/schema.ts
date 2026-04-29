import { createPageStateChildInputSchema, createPageStateChildOutputSchema } from "../../contract.js";

export const DetectVideoStableChildInputSchema = createPageStateChildInputSchema("detect-video-stable");
export const DetectVideoStableChildOutputSchema = createPageStateChildOutputSchema("detect-video-stable");

export type DetectVideoStableChildInput = import("../../schema.js").PageStateAbilityInput & { childCapabilityId: "detect-video-stable" };
export type DetectVideoStableChildOutput = import("../../schema.js").PageStateChildDetection & { childCapabilityId: "detect-video-stable" };