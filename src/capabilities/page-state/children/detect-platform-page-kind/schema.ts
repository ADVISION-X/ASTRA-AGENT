import { createPageStateChildInputSchema, createPageStateChildOutputSchema } from "../../contract.js";

export const DetectPlatformPageKindChildInputSchema = createPageStateChildInputSchema("detect-platform-page-kind");
export const DetectPlatformPageKindChildOutputSchema = createPageStateChildOutputSchema("detect-platform-page-kind");

export type DetectPlatformPageKindChildInput = import("../../schema.js").PageStateAbilityInput & { childCapabilityId: "detect-platform-page-kind" };
export type DetectPlatformPageKindChildOutput = import("../../schema.js").PageStateChildDetection & { childCapabilityId: "detect-platform-page-kind" };