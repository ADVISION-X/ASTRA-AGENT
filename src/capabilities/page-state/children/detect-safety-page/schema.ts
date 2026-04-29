import { createPageStateChildInputSchema, createPageStateChildOutputSchema } from "../../contract.js";

export const DetectSafetyPageChildInputSchema = createPageStateChildInputSchema("detect-safety-page");
export const DetectSafetyPageChildOutputSchema = createPageStateChildOutputSchema("detect-safety-page");

export type DetectSafetyPageChildInput = import("../../schema.js").PageStateAbilityInput & { childCapabilityId: "detect-safety-page" };
export type DetectSafetyPageChildOutput = import("../../schema.js").PageStateChildDetection & { childCapabilityId: "detect-safety-page" };