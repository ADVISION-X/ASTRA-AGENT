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
