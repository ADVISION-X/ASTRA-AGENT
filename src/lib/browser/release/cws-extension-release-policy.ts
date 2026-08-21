import {
  assertCwsReleaseIdentity,
  type CwsExtensionReleaseIdentity,
} from "./cws-extension-release-identity.js";

/**
 * This policy applies to the one MV3 page channel. It is intentionally local
 * and explicit: a development build may be used by its operator, while the
 * old CWS package can never regain authority and a reviewed release may not
 * move backwards.
 */
export const CWS_EXTENSION_RELEASE_POLICY = Object.freeze({
  minimumVersion: "0.2.0",
  revokedVersions: ["0.1.1"] as const,
});

export const assertCwsExtensionReleasePolicy = (identity: CwsExtensionReleaseIdentity): void => {
  assertCwsReleaseIdentity(identity);
  if (CWS_EXTENSION_RELEASE_POLICY.revokedVersions.includes(identity.installedExtensionVersion as "0.1.1")) {
    throw new Error("BROWSER_CWS_LEGACY_VERSION_FROZEN");
  }
  if (compareSemver(identity.installedExtensionVersion, CWS_EXTENSION_RELEASE_POLICY.minimumVersion) < 0) {
    throw new Error("BROWSER_ROLLBACK_REJECTED");
  }
};

const compareSemver = (left: string, right: string): number => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
};
