import type { VisualTargetChildCapabilityId } from "../contract.js";
import type { VisualTargetProfileOverride } from "../shared/visual-target-profile.js";

export interface VisualTargetProfilePort {
  resolveProfileOverride(input: {
    childCapabilityId: VisualTargetChildCapabilityId;
  }): VisualTargetProfileOverride | null;
}