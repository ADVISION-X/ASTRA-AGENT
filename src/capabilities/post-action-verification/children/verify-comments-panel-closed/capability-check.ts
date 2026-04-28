import { createVerifyCommentsPanelClosedCapability } from "./implementation.js";

export async function verifyCommentsPanelClosedCapability(): Promise<void> {
  const capability = createVerifyCommentsPanelClosedCapability();
  if (capability.childCapabilityId !== "verify-comments-panel-closed") {
    throw new Error("verify-comments-panel-closed capability metadata drift detected");
  }
}