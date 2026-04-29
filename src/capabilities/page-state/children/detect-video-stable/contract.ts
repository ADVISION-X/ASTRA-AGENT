import type { PageStateChildCapability } from "../../contract.js";

export { DetectVideoStableChildInputSchema, DetectVideoStableChildOutputSchema } from "./schema.js";
export type { DetectVideoStableChildInput, DetectVideoStableChildOutput } from "./schema.js";

export interface DetectVideoStableChildCapability extends PageStateChildCapability {
  readonly childCapabilityId: "detect-video-stable";
  execute(input: import("./schema.js").DetectVideoStableChildInput): Promise<import("./schema.js").DetectVideoStableChildOutput>;
}