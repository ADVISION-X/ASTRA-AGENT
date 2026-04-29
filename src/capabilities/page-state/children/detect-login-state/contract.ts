import type { PageStateChildCapability } from "../../contract.js";

export { DetectLoginStateChildInputSchema, DetectLoginStateChildOutputSchema } from "./schema.js";
export type { DetectLoginStateChildInput, DetectLoginStateChildOutput } from "./schema.js";

export interface DetectLoginStateChildCapability extends PageStateChildCapability {
  readonly childCapabilityId: "detect-login-state";
  execute(input: import("./schema.js").DetectLoginStateChildInput): Promise<import("./schema.js").DetectLoginStateChildOutput>;
}