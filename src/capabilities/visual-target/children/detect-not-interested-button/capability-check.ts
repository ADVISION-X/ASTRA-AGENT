import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectNotInterestedButtonCapability } from "./implementation.js";

export async function verifyDetectNotInterestedButtonCapability(): Promise<void> {
  const capability = createDetectNotInterestedButtonCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-not-interested-button") {
    throw new Error("detect-not-interested-button capability metadata drift detected");
  }
}