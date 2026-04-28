import { createVerifyPageOpenedCapability } from "./implementation.js";

export async function verifyPageOpenedCapability(): Promise<void> {
  const capability = createVerifyPageOpenedCapability();
  if (capability.childCapabilityId !== "verify-page-opened") {
    throw new Error("verify-page-opened capability metadata drift detected");
  }
}