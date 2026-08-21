import {
  GRASSEYE_BROWSER_EXTENSION_ID,
  hashCwsReleaseValue,
  type CwsExtensionReleaseIdentity,
} from "./cws-extension-release-identity.js";

export type CwsExtensionReleaseProof = Readonly<{
  mode: "development" | "cws-reviewed";
  identity: CwsExtensionReleaseIdentity;
}>;

const permissionPolicy = Object.freeze({ permissions: ["debugger"], hostPermissions: [] as string[] });
const originPolicy = Object.freeze({ matches: ["http://127.0.0.1/*"] });

/**
 * The local source build is deliberately labelled development until its exact
 * CWS package receives a review receipt.  Development loading is test-only;
 * it is never a production installation claim.
 */
export const createCwsExtensionReleaseProof = (
  version: string,
  reviewReceiptRef = process.env.GRASSEYE_BROWSER_CWS_REVIEW_RECEIPT ?? null,
): CwsExtensionReleaseProof => ({
  mode: reviewReceiptRef ? "cws-reviewed" : "development",
  identity: {
    installedExtensionId: GRASSEYE_BROWSER_EXTENSION_ID,
    installedExtensionVersion: version,
    sourcePackageHash: hashCwsReleaseValue({ extensionId: GRASSEYE_BROWSER_EXTENSION_ID, version }),
    permissionPolicyHash: hashCwsReleaseValue(permissionPolicy),
    originPolicyHash: hashCwsReleaseValue(originPolicy),
    cwsReviewReceiptRef: reviewReceiptRef,
  },
});

export const assertCwsReviewedReleaseProof = (proof: CwsExtensionReleaseProof): void => {
  if (proof.mode !== "cws-reviewed" || proof.identity.cwsReviewReceiptRef === null) {
    throw new Error("BROWSER_CWS_REVIEW_REQUIRED");
  }
};
