import type { PageStateChildCapability } from "../../contract.js";

export { DetectPlatformPageKindChildInputSchema, DetectPlatformPageKindChildOutputSchema } from "./schema.js";
export type { DetectPlatformPageKindChildInput, DetectPlatformPageKindChildOutput } from "./schema.js";

export interface DetectPlatformPageKindChildCapability extends PageStateChildCapability {
  readonly childCapabilityId: "detect-platform-page-kind";
  execute(input: import("./schema.js").DetectPlatformPageKindChildInput): Promise<import("./schema.js").DetectPlatformPageKindChildOutput>;
}