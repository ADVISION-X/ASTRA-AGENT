import {
  GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  GRASSEYE_BROWSER_RELEASE_SEQUENCE,
} from "./browser-release-identity.js";

export type BrowserReleaseSecurityPolicy = Readonly<{
  schemaVersion: "grasseye-browser-release-security-policy-v1";
  currentReleaseIdentity: string;
  currentReleaseSequence: number;
  minimumAcceptedReleaseSequence: number;
  revokedReleaseIdentities: readonly string[];
}>;

export const BROWSER_RELEASE_SECURITY_POLICY: BrowserReleaseSecurityPolicy = Object.freeze({
  schemaVersion: "grasseye-browser-release-security-policy-v1",
  currentReleaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
  currentReleaseSequence: GRASSEYE_BROWSER_RELEASE_SEQUENCE,
  minimumAcceptedReleaseSequence: GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
  revokedReleaseIdentities: Object.freeze([]),
});

export const assertBrowserReleaseAllowed = (input: Readonly<{
  releaseIdentity: string;
  releaseSequence: number;
}>): void => {
  if (!Number.isSafeInteger(input.releaseSequence) || input.releaseSequence <= 0) {
    throw new Error("BROWSER_RELEASE_SEQUENCE_INVALID");
  }
  if (input.releaseSequence < BROWSER_RELEASE_SECURITY_POLICY.minimumAcceptedReleaseSequence) {
    throw new Error("BROWSER_RELEASE_ROLLBACK_REJECTED");
  }
  if (BROWSER_RELEASE_SECURITY_POLICY.revokedReleaseIdentities.includes(input.releaseIdentity)) {
    throw new Error("BROWSER_RELEASE_REVOKED");
  }
  if (
    input.releaseIdentity !== BROWSER_RELEASE_SECURITY_POLICY.currentReleaseIdentity
    || input.releaseSequence !== BROWSER_RELEASE_SECURITY_POLICY.currentReleaseSequence
  ) {
    throw new Error("BROWSER_RELEASE_IDENTITY_MISMATCH");
  }
};
