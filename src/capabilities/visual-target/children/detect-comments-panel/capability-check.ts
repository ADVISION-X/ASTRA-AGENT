import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { createDetectCommentsPanelCapability } from "./implementation.js";

export async function verifyDetectCommentsPanelCapability(): Promise<void> {
  const capability = createDetectCommentsPanelCapability();
  if (capability.abilityGroupId !== VISUAL_TARGET_ABILITY_GROUP_ID || capability.childCapabilityId !== "detect-comments-panel") {
    throw new Error("detect-comments-panel capability metadata drift detected");
  }
}