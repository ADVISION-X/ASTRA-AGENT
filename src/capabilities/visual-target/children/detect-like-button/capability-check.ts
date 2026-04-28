import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectLikeButtonCapability } from "./implementation.js";

export async function verifyDetectLikeButtonCapability(): Promise<void> {
  const capability = createDetectLikeButtonCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-like-button") {
    throw new Error("detect-like-button capability metadata drift detected");
  }
}