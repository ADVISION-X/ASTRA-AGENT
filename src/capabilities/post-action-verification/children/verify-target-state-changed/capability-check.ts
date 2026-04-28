import { createVerifyTargetStateChangedCapability } from "./implementation.js";

export async function verifyTargetStateChangedCapability(): Promise<void> {
  const capability = createVerifyTargetStateChangedCapability();
  if (capability.childCapabilityId !== "verify-target-state-changed") {
    throw new Error("verify-target-state-changed capability metadata drift detected");
  }
}