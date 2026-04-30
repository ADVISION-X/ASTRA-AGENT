import type { VisualTargetProfileOverride } from "../shared/visual-target-profile.js";
import type { VISUAL_TARGET_CHILD_CAPABILITY_IDS } from "../shared/visual-target-types.js";

type VisualTargetChildCapabilityId = (typeof VISUAL_TARGET_CHILD_CAPABILITY_IDS)[number];

export interface VisualTargetProfilePort {
  resolveProfileOverride(input: {
    childCapabilityId: VisualTargetChildCapabilityId;
  }): VisualTargetProfileOverride | null;
}