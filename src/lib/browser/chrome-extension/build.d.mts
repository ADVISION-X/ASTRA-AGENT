export type BrowserExtensionBuildReceipt = Readonly<{
  outputDirectory: string;
  schemaVersion: "grasseye.browser.extension-build.v1";
  esbuildVersion: string;
  inputs: readonly Readonly<{ path: string; sha256: `sha256:${string}` }>[];
  files: readonly Readonly<{ path: string; sha256: `sha256:${string}` }>[];
  extensionTreeHash: `sha256:${string}`;
  releaseRecordPath: string;
  releaseBuildId: string;
}>;

export function buildChromeExtension(argv?: readonly string[]): Promise<BrowserExtensionBuildReceipt>;
