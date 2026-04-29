import { createPageStateChildInputSchema, createPageStateChildOutputSchema } from "../../contract.js";

export const DetectCommentPanelStateChildInputSchema = createPageStateChildInputSchema("detect-comment-panel-state");
export const DetectCommentPanelStateChildOutputSchema = createPageStateChildOutputSchema("detect-comment-panel-state");

export type DetectCommentPanelStateChildInput = import("../../schema.js").PageStateAbilityInput & { childCapabilityId: "detect-comment-panel-state" };
export type DetectCommentPanelStateChildOutput = import("../../schema.js").PageStateChildDetection & { childCapabilityId: "detect-comment-panel-state" };