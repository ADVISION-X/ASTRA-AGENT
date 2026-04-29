import type { PageStateChildCapability } from "../../contract.js";

export { DetectPageAbnormalityChildInputSchema, DetectPageAbnormalityChildOutputSchema } from "./schema.js";
export type { DetectPageAbnormalityChildInput, DetectPageAbnormalityChildOutput } from "./schema.js";

export interface DetectPageAbnormalityChildCapability extends PageStateChildCapability {
  readonly childCapabilityId: "detect-page-abnormality";
  execute(input: import("./schema.js").DetectPageAbnormalityChildInput): Promise<import("./schema.js").DetectPageAbnormalityChildOutput>;
}