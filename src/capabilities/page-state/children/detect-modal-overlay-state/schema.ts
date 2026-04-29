import { createPageStateChildInputSchema, createPageStateChildOutputSchema } from "../../contract.js";

export const DetectModalOverlayStateChildInputSchema = createPageStateChildInputSchema("detect-modal-overlay-state");
export const DetectModalOverlayStateChildOutputSchema = createPageStateChildOutputSchema("detect-modal-overlay-state");

export type DetectModalOverlayStateChildInput = import("../../schema.js").PageStateAbilityInput & { childCapabilityId: "detect-modal-overlay-state" };
export type DetectModalOverlayStateChildOutput = import("../../schema.js").PageStateChildDetection & { childCapabilityId: "detect-modal-overlay-state" };