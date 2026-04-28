import type { BrowserCaptureResult, BrowserController } from "../../browser/browser-controller.js";
import type { PlatformCapabilityStatus, PlatformOperatorModeInfo, PlatformRuntimeDiagnostics, PlatformRuntimePageCapture, VideoOrientationMode } from "../platform-runtime-contract.js";
import type { RuntimePageReadyStatus } from "../../../types/runtime.js";
import { normalizeVideoId, summarizeLoginState, TIKTOK_PLATFORM_ID, TikTokPlatformVideo } from "./identity.js";

export function createDefaultOperatorModeInfo(): PlatformOperatorModeInfo {
  return {
    executionMode: "Vision-first Coordinate Mode",
    fallbackMode: "Visual-only Coordinate Runtime",
    geometryGuard: "Not calibrated",
    viewport: "unknown",
    calibration: "Calibration required",
    orientation: "unknown",
  };
}

export function buildRuntimeDiagnostics(input: {
  browserController: BrowserController;
  startUrl: string;
  pageReadyStatus: RuntimePageReadyStatus;
  lastNavigationError: string | null;
}): PlatformRuntimeDiagnostics {
  const session = input.browserController.getSessionState();
  return {
    targetUrl: input.startUrl,
    currentUrl: session.currentUrl,
    pageTitle: session.currentTitle,
    pageReadyStatus: input.pageReadyStatus,
    lastNavigationError: input.lastNavigationError,
  };
}

export function buildCapabilityStatus(input: {
  operatorModeInfo: PlatformOperatorModeInfo;
  videoOrientation: VideoOrientationMode;
}): PlatformCapabilityStatus[] {
  return [
    {
      id: "visual-coordinate-runtime",
      label: "Visual Coordinate Runtime",
      tone: input.operatorModeInfo.geometryGuard === "Calibrated" ? "ok" : "degraded",
      coordinateReady: input.operatorModeInfo.geometryGuard === "Calibrated",
      detail: `${input.operatorModeInfo.executionMode} · orientation=${input.videoOrientation} · ${input.operatorModeInfo.geometryGuard}`,
    },
    {
      id: "comments-panel-capture",
      label: "Comments Panel Capture",
      tone: "ok",
      coordinateReady: true,
      detail: "Comments panel actions stay on governed visual targets and post-action verification.",
    },
  ];
}

export async function captureRuntimePageState(input: {
  browserController: BrowserController;
  captureBrowserRegion: (input: { regionLabel: string; contentLines?: string[] }) => Promise<BrowserCaptureResult>;
  startUrl: string;
  currentIndex: number;
  currentVideo: TikTokPlatformVideo | null;
}): Promise<PlatformRuntimePageCapture> {
  const session = input.browserController.getSessionState();
  const capture = await input.captureBrowserRegion({
    regionLabel: "runtime-page-state",
    contentLines: [session.currentUrl || input.startUrl, summarizeLoginState(session.loginState)],
  });
  return {
    platformId: TIKTOK_PLATFORM_ID,
    sourceId: normalizeVideoId({
      roundIndex: input.currentIndex,
      ...(input.currentVideo?.visualSignature ? { visualSignature: input.currentVideo.visualSignature } : {}),
    }),
    summary: `visual runtime page capture ${capture.browserActionId}`,
    capture,
  };
}