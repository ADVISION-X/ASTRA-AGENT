import type { PageStateAbilityInput, PageStateChildCapabilityId, PageStateChildDetection } from "../schema.js";

export interface PageStateChildCapability {
  readonly abilityGroupId: "page-state";
  readonly childCapabilityId: PageStateChildCapabilityId;

  execute(input: PageStateAbilityInput): Promise<PageStateChildDetection>;
}