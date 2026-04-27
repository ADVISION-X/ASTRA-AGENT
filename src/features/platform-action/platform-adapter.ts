import type { BrowserCaptureResult } from "../../lib/browser/browser-controller.js";
import type { PlatformActionRequest, PlatformActionResult } from "../../types/platform-action.js";
import type { RuntimePageReadyStatus } from "../../types/runtime.js";

export type PlatformVideo = {
  id: string;
  title: string;
  pageUrl: string;
  summary: string;
  tags: string[];
  comments: string[];
};

export type PlatformObservation = {
  platformId: string;
  video: PlatformVideo;
  actionResult: PlatformActionResult;
};

export type PlatformCapture = {
  platformId: string;
  video: PlatformVideo;
  capture: BrowserCaptureResult;
  actionResult: PlatformActionResult;
};

export type PlatformRuntimePageCapture = {
  platformId: string;
  sourceId: string;
  summary: string;
  capture: BrowserCaptureResult;
};

export type PlatformOperatorModeInfo = {
  executionMode: string;
  fallbackMode: string;
  geometryGuard: string;
  viewport: string;
  calibration: string;
};

export type PlatformRuntimeDiagnostics = {
  targetUrl: string | null;
  currentUrl: string;
  pageTitle: string;
  pageReadyStatus: RuntimePageReadyStatus;
  lastNavigationError: string | null;
};

export interface PlatformAdapter {
  readonly platformId: string;
  readonly defaultMaxRounds: number;

  getOperatorModeInfo(): PlatformOperatorModeInfo;
  getRuntimeDiagnostics(): PlatformRuntimeDiagnostics;
  captureRuntimePageState(requestInput: PlatformActionRequest): Promise<PlatformRuntimePageCapture>;
  listVideos(): PlatformVideo[];
  reset(): void;
  seek(index: number): void;
  hasCurrentVideo(): boolean;
  openFeed(requestInput: PlatformActionRequest): Promise<PlatformActionResult>;
  observeCurrentVideo(requestInput: PlatformActionRequest): Promise<PlatformObservation>;
  captureVideoRegion(requestInput: PlatformActionRequest): Promise<PlatformCapture>;
  clickNotInterested(requestInput: PlatformActionRequest): Promise<PlatformActionResult>;
  likeOrSaveCandidate(requestInput: PlatformActionRequest): Promise<PlatformActionResult>;
  openComments(requestInput: PlatformActionRequest): Promise<PlatformActionResult>;
  captureCommentRegion(requestInput: PlatformActionRequest): Promise<PlatformCapture>;
  continueNext(requestInput: PlatformActionRequest): Promise<PlatformActionResult>;
  close(requestInput: PlatformActionRequest): Promise<PlatformActionResult>;
}