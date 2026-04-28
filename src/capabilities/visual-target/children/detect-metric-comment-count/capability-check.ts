import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectMetricCommentCountCapability } from "./implementation.js";

export async function verifyDetectMetricCommentCountCapability(): Promise<void> {
  const capability = createDetectMetricCommentCountCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-metric-comment-count") {
    throw new Error("detect-metric-comment-count capability metadata drift detected");
  }
}