import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectSaveButtonCapability } from "./implementation.js";

export async function verifyDetectSaveButtonCapability(): Promise<void> {
  const capability = createDetectSaveButtonCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-save-button") {
    throw new Error("detect-save-button capability metadata drift detected");
  }
}