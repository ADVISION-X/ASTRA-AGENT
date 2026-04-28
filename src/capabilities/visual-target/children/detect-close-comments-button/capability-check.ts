import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectCloseCommentsButtonCapability } from "./implementation.js";

export async function verifyDetectCloseCommentsButtonCapability(): Promise<void> {
  const capability = createDetectCloseCommentsButtonCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-close-comments-button") {
    throw new Error("detect-close-comments-button capability metadata drift detected");
  }
}