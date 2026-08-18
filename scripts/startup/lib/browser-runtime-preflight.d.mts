export type BrowserRuntimePreflightResult =
  | Readonly<{
      status: "READY";
      artifactRoot: string;
      browserctlPath: string;
    }>
  | Readonly<{
      status: "BLOCKED";
      code: string;
      actionableMessage: string;
      missingEnvironmentVariables?: readonly string[];
    }>;

export declare function runBrowserRuntimePreflight(input: {
  rootDir: string;
  env?: NodeJS.ProcessEnv;
}): Promise<BrowserRuntimePreflightResult>;

export declare function resolveBrowserRuntimeArtifactRoot(
  rootDir: string,
  platform?: string,
  architecture?: string,
): string;
