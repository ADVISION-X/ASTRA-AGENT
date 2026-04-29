import type { PageStateChildCapability } from "../../contract.js";

export { DetectFeedReadyChildInputSchema, DetectFeedReadyChildOutputSchema } from "./schema.js";
export type { DetectFeedReadyChildInput, DetectFeedReadyChildOutput } from "./schema.js";

export interface DetectFeedReadyChildCapability extends PageStateChildCapability {
  readonly childCapabilityId: "detect-feed-ready";
  execute(input: import("./schema.js").DetectFeedReadyChildInput): Promise<import("./schema.js").DetectFeedReadyChildOutput>;
}