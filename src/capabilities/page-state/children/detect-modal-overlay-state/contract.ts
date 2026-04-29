import type { PageStateChildCapability } from "../../contract.js";

export { DetectModalOverlayStateChildInputSchema, DetectModalOverlayStateChildOutputSchema } from "./schema.js";
export type { DetectModalOverlayStateChildInput, DetectModalOverlayStateChildOutput } from "./schema.js";

export interface DetectModalOverlayStateChildCapability extends PageStateChildCapability {
  readonly childCapabilityId: "detect-modal-overlay-state";
  execute(input: import("./schema.js").DetectModalOverlayStateChildInput): Promise<import("./schema.js").DetectModalOverlayStateChildOutput>;
}