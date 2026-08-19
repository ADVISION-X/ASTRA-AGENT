export type BrowserArtifactManifest = Readonly<{
  schemaVersion: "grasseye-browser-artifact-set-v2";
  releaseIdentity: string;
  releaseSequence: number;
  minimumAcceptedReleaseSequence: number;
  protocolVersion: string;
  extensionId: string;
  artifactMode: "production" | "test";
  platformArch: string;
  sourceCommitSha: string;
  builderIdentity: string;
  host: Readonly<{ path: string; sha256: string }>;
  browserctl: Readonly<{ path: string; sha256: string }>;
  extension: Readonly<{ path: string; manifestSha256: string; treeSha256: string }>;
}>;

export type VerifiedBrowserArtifactSet = Readonly<{
  manifest: BrowserArtifactManifest;
  manifestPath: string;
  signaturePath: string;
  artifactSetSha256: string;
  hostPath: string;
  browserctlPath: string;
  extensionPath: string;
}>;

export function resolveBrowserRuntimeArtifactRoot(rootDir: string, platform?: string, architecture?: string): string;
export function verifyBrowserArtifactSet(artifactRoot: string): Promise<VerifiedBrowserArtifactSet>;
