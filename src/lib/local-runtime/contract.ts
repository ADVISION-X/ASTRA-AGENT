/**
 * contract.ts — Workbench construction contract types.
 *
 * Defines options for creating a local workbench.
 * No mission truth, no AI truth, no forensics.
 */

type RequestedPlatformId =
  | "tiktok-web"
  | "facebook-web"
  | "macos-local"
  | "iphone-mirroring-facebook-app"
  | "iphone-mirroring-tiktok-app";

export type GrassEyePlatformTarget = RequestedPlatformId | "agent-shell";

export type GrassEyeWorkbenchOptions = {
  dataDir?: string;
  baseUrl: string;
  platformTarget: GrassEyePlatformTarget;
  browserModeMarker?: string;
  startupReadiness?: {
    localAiReady: boolean;
    platformTarget: GrassEyePlatformTarget;
    detail?: string | null;
  } | null;
  realPlatformUrl?: string;
  browserHeadless?: boolean;
};
