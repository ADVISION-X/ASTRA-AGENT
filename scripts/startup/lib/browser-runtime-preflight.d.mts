export type BrowserRuntimePreflightResult =
  | Readonly<{
      status: "READY";
      releaseState: "PRESENT";
      activationPath: string;
    }>
  | Readonly<{
      status: "BLOCKED";
      code: string;
      actionableMessage: string;
      missingEnvironmentVariables?: readonly string[];
    }>;

export declare function runBrowserRuntimePreflight(): Promise<BrowserRuntimePreflightResult>;
