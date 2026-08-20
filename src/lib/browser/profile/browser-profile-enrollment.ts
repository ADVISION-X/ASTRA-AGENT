import { createHash } from "node:crypto";
import type { BrowserProfileConfig } from "./browser-profile-config.js";
import type { BrowserProfileState } from "./browser-profile-state.js";

export const createBrowserProfileEnrollment = (input: {
  config: BrowserProfileConfig;
  policyHash: `sha256:${string}`;
  extensionTreeHash: `sha256:${string}`;
}): BrowserProfileState => {
  const enrollmentHash = `sha256:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}` as const;
  return {
    profileRef: input.config.profileRef,
    enrollmentHash,
    policyHash: input.policyHash,
    extensionTreeHash: input.extensionTreeHash,
    enrolledAt: new Date().toISOString(),
  };
};
