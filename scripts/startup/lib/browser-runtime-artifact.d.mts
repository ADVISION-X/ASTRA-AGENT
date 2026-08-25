import type { BrowserRuntimePreflightResult } from "./browser-runtime-preflight.mjs";

export type BrowserRuntimeArtifactSyncResult = Readonly<{
  rebuilt: boolean;
  preflight: BrowserRuntimePreflightResult;
}>;

export declare function ensureCurrentBrowserRuntimeArtifact(input: Readonly<{
  rootDir: string;
  runBuild?: () => Promise<void>;
  readPreflight?: () => Promise<BrowserRuntimePreflightResult>;
}>): Promise<BrowserRuntimeArtifactSyncResult>;
