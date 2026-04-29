import type { PageStateChildCapability } from "../../contract.js";

export { DetectSafetyPageChildInputSchema, DetectSafetyPageChildOutputSchema } from "./schema.js";
export type { DetectSafetyPageChildInput, DetectSafetyPageChildOutput } from "./schema.js";

export interface DetectSafetyPageChildCapability extends PageStateChildCapability {
  readonly childCapabilityId: "detect-safety-page";
  execute(input: import("./schema.js").DetectSafetyPageChildInput): Promise<import("./schema.js").DetectSafetyPageChildOutput>;
}