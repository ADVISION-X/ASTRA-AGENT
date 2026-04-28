import { createVerifyCommentsPanelOpenedCapability } from "./implementation.js";

export async function verifyCommentsPanelOpenedCapability(): Promise<void> {
  const capability = createVerifyCommentsPanelOpenedCapability();
  if (capability.childCapabilityId !== "verify-comments-panel-opened") {
    throw new Error("verify-comments-panel-opened capability metadata drift detected");
  }
}