import { createPageStateChildInputSchema, createPageStateChildOutputSchema } from "../../contract.js";

export const DetectPageAbnormalityChildInputSchema = createPageStateChildInputSchema("detect-page-abnormality");
export const DetectPageAbnormalityChildOutputSchema = createPageStateChildOutputSchema("detect-page-abnormality");

export type DetectPageAbnormalityChildInput = import("../../schema.js").PageStateAbilityInput & { childCapabilityId: "detect-page-abnormality" };
export type DetectPageAbnormalityChildOutput = import("../../schema.js").PageStateChildDetection & { childCapabilityId: "detect-page-abnormality" };