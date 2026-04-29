import type { PageStateChildCapability } from "../../contract.js";

export { DetectCommentPanelStateChildInputSchema, DetectCommentPanelStateChildOutputSchema } from "./schema.js";
export type { DetectCommentPanelStateChildInput, DetectCommentPanelStateChildOutput } from "./schema.js";

export interface DetectCommentPanelStateChildCapability extends PageStateChildCapability {
  readonly childCapabilityId: "detect-comment-panel-state";
  execute(input: import("./schema.js").DetectCommentPanelStateChildInput): Promise<import("./schema.js").DetectCommentPanelStateChildOutput>;
}