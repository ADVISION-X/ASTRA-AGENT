import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectCommentsButtonCapability } from "./implementation.js";

export async function verifyDetectCommentsButtonCapability(): Promise<void> {
  const capability = createDetectCommentsButtonCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-comments-button") {
    throw new Error("detect-comments-button capability metadata drift detected");
  }
}