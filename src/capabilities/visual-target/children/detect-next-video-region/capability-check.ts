import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectNextVideoRegionCapability } from "./implementation.js";

export async function verifyDetectNextVideoRegionCapability(): Promise<void> {
  const capability = createDetectNextVideoRegionCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-next-video-region") {
    throw new Error("detect-next-video-region capability metadata drift detected");
  }
}