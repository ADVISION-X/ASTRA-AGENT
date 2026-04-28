import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectMetricLikeCountCapability } from "./implementation.js";

export async function verifyDetectMetricLikeCountCapability(): Promise<void> {
  const capability = createDetectMetricLikeCountCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-metric-like-count") {
    throw new Error("detect-metric-like-count capability metadata drift detected");
  }
}