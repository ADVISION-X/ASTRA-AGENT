import { createVerifyVideoChangedAfterScrollCapability } from "./implementation.js";

export async function verifyVideoChangedAfterScrollCapability(): Promise<void> {
  const capability = createVerifyVideoChangedAfterScrollCapability();
  if (capability.childCapabilityId !== "verify-video-changed-after-scroll") {
    throw new Error("verify-video-changed-after-scroll capability metadata drift detected");
  }
}