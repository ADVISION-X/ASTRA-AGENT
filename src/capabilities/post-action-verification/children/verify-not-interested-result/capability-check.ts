import { createVerifyNotInterestedResultCapability } from "./implementation.js";

export async function verifyNotInterestedResultCapability(): Promise<void> {
  const capability = createVerifyNotInterestedResultCapability();
  if (capability.childCapabilityId !== "verify-not-interested-result") {
    throw new Error("verify-not-interested-result capability metadata drift detected");
  }
}