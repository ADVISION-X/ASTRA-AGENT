import type { LocalBrowserSessionState } from "../../types/local-browser-session.js";

import { createId } from "../local-runtime/ids.js";

export type BrowserActionResult = {
  browserActionId: string;
  ok: boolean;
  message: string;
  createdAt: string;
  fallbackUsed: boolean;
};

export type BrowserCaptureResult = {
  browserActionId: string;
  pageUrl: string;
  pageTitle: string;
  regionLabel: string;
  regionType: string;
  width: number;
  height: number;
  contentLines?: string[];
  sourceFilePath?: string;
  createdAt: string;
};

export type BrowserStateSnapshot = LocalBrowserSessionState & {
  open: boolean;
  currentUrl: string;
  currentTitle: string;
  browserExecutable: string | null;
};

export type BrowserGeometrySnapshot = {
  windowX: number;
  windowY: number;
  viewportWidth: number;
  viewportHeight: number;
  screenshotWidth: number;
  screenshotHeight: number;
  scaleFactor: number;
  currentUrl: string;
  pageTitle: string;
  visibleContentBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  capturedAt: string;
};

export type BrowserClickCoordinateSpace = "browserViewport" | "desktopScreen";
export type BrowserClickButton = "left" | "right" | "middle";
export type BrowserScrollCoordinateSpace = "browserViewport" | "desktopScreen";

export interface BrowserController {
  getHealth(): { ok: boolean; detail: string };
  getSessionState(): BrowserStateSnapshot;
  getGeometrySnapshot(): Promise<BrowserGeometrySnapshot>;
  open(input: { url: string; title: string }): Promise<BrowserActionResult>;
  scroll(input: {
    targetLabel: string;
    deltaX: number;
    deltaY: number;
    coordinateSpace?: BrowserScrollCoordinateSpace;
    anchorPoint?: { x: number; y: number };
    fallbackUsed?: boolean;
  }): Promise<BrowserActionResult>;
  click(input: {
    targetLabel: string;
    point: { x: number; y: number };
    coordinateSpace?: BrowserClickCoordinateSpace;
    button?: BrowserClickButton;
    clickCount?: 1 | 2;
    fallbackUsed?: boolean;
  }): Promise<BrowserActionResult>;
  screenshotRegion(input: { regionLabel: string; contentLines?: string[] }): Promise<BrowserCaptureResult>;
  wait(durationMs: number): Promise<BrowserActionResult>;
  close(): Promise<BrowserActionResult>;
}