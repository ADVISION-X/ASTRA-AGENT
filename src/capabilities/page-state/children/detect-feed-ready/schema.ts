import { createPageStateChildInputSchema, createPageStateChildOutputSchema } from "../../contract.js";

export const DetectFeedReadyChildInputSchema = createPageStateChildInputSchema("detect-feed-ready");
export const DetectFeedReadyChildOutputSchema = createPageStateChildOutputSchema("detect-feed-ready");

export type DetectFeedReadyChildInput = import("../../schema.js").PageStateAbilityInput & { childCapabilityId: "detect-feed-ready" };
export type DetectFeedReadyChildOutput = import("../../schema.js").PageStateChildDetection & { childCapabilityId: "detect-feed-ready" };