import { createHash } from "node:crypto";

export const GRASSEYE_BROWSER_EXTENSION_ID = "emkmbecadncngofidjgocmifhbonifgm";
export const FROZEN_LEGACY_CWS_VERSION = "0.1.1";

export type CwsExtensionReleaseIdentity = Readonly<{
  installedExtensionId: string;
  installedExtensionVersion: string;
  sourcePackageHash: `sha256:${string}`;
  permissionPolicyHash: `sha256:${string}`;
  originPolicyHash: `sha256:${string}`;
  cwsReviewReceiptRef: string | null;
}>;

export const hashCwsReleaseValue = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export const assertNotFrozenLegacyVersion = (version: string): void => {
  if (version === "0.1.1") throw new Error("BROWSER_CWS_LEGACY_VERSION_FROZEN");
  if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error("BROWSER_CWS_RELEASE_IDENTITY_INVALID");
};

export const assertCwsReleaseIdentity = (identity: CwsExtensionReleaseIdentity): void => {
  if (identity.installedExtensionId !== GRASSEYE_BROWSER_EXTENSION_ID) {
    throw new Error("BROWSER_CWS_EXTENSION_ID_INVALID");
  }
  assertNotFrozenLegacyVersion(identity.installedExtensionVersion);
  if (
    !isHash(identity.sourcePackageHash)
    || !isHash(identity.permissionPolicyHash)
    || !isHash(identity.originPolicyHash)
    || (identity.cwsReviewReceiptRef !== null && identity.cwsReviewReceiptRef.trim().length === 0)
  ) {
    throw new Error("BROWSER_CWS_RELEASE_IDENTITY_INVALID");
  }
};

const isHash = (value: string): value is `sha256:${string}` => /^sha256:[a-f0-9]{64}$/u.test(value);
