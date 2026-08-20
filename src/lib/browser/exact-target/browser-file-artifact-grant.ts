import type { BrowserHash } from "./browser-target-ref.js";

export type BrowserFileArtifactGrantV1 = Readonly<{
  schemaVersion: "browser-file-artifact-grant-v1";
  grantRef: string;
  authorityEpoch: number;
  executionBindingHash: BrowserHash;
  artifactRef: string;
  contentHash: BrowserHash;
  maxBytes: number;
  expiresAt: string;
}>;

export type BrowserSealedFileArtifactGrant = Readonly<{
  publicGrant: BrowserFileArtifactGrantV1;
  canonicalPath: string;
  inode: string;
}>;

export const assertActiveFileGrant = (grant: BrowserFileArtifactGrantV1, now = Date.now()): void => {
  if (grant.schemaVersion !== "browser-file-artifact-grant-v1" || Date.parse(grant.expiresAt) <= now) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
};
