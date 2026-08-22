export type BrowserRuntimePreflightResult = Readonly<{
  status: "READY";
  authorityState: "BROWSER_AUTHORITY_ABSENT";
  releaseState: "REPAIR_REQUIRED" | "UNPACKED_WEBSOCKET_AUTHORITY";
  failureReason: string;
  actionableMessage: string;
  releaseBuildId?: string;
  extensionDirectoryHashV1?: `sha256:${string}`;
}>;

export declare function runBrowserRuntimePreflight(): Promise<BrowserRuntimePreflightResult>;
