import { createPageStateChildInputSchema, createPageStateChildOutputSchema } from "../../contract.js";

export const DetectLoginStateChildInputSchema = createPageStateChildInputSchema("detect-login-state");
export const DetectLoginStateChildOutputSchema = createPageStateChildOutputSchema("detect-login-state");

export type DetectLoginStateChildInput = import("../../schema.js").PageStateAbilityInput & { childCapabilityId: "detect-login-state" };
export type DetectLoginStateChildOutput = import("../../schema.js").PageStateChildDetection & { childCapabilityId: "detect-login-state" };