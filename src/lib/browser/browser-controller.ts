import type { LocalBrowserSessionState } from "../../types/local-browser-session.js";

import { createId } from "../local-runtime/ids.js";

type BrowserActionResult = {
  browserActionId: string;
  ok: boolean;
  message: string;
  createdAt: string;
};

type BrowserCaptureResult = {
  browserActionId: string;
  pageUrl: string;
  pageTitle: string;
  regionLabel: string;
  regionType: string;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  contentLines?: string[];
  sourceFilePath: string;
  createdAt: string;
};

type BrowserScreenshotProfile = "default" | "observation_lightweight";

type BrowserStateSnapshot = LocalBrowserSessionState & {
  open: boolean;
  currentUrl: string;
  currentTitle: string;
  browserExecutable: string | null;
};

type BrowserGeometrySnapshot = {
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

type BrowserClickCoordinateSpace = "browserViewport" | "desktopScreen";
type BrowserClickButton = "left" | "right" | "middle";
type BrowserScrollCoordinateSpace = "browserViewport" | "desktopScreen";
type BrowserTextInputAction = "type-text" | "clear-input" | "press-key";
type BrowserTextInputKey = "Enter" | "Tab" | "Escape" | "Backspace" | "Delete" | "L" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
type BrowserOpenReusePolicy = "reuse-exact-url" | "open-new-tab" | "reuse-active-tab" | "reuse-host-tab";

type BrowserFileInputRef = {
  selector: string;
  targetKind: "file-input";
};

interface BrowserController {
  getHealth(): { ok: boolean; detail: string };
  getSessionState(): BrowserStateSnapshot;
  getGeometrySnapshot(): Promise<BrowserGeometrySnapshot>;
  open(input: { url: string; title: string; reusePolicy?: BrowserOpenReusePolicy }): Promise<BrowserActionResult>;
  scroll(input: {
    targetLabel: string;
    deltaX: number;
    deltaY: number;
    coordinateSpace?: BrowserScrollCoordinateSpace;
    anchorPoint?: { x: number; y: number };
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  click(input: {
    targetLabel: string;
    point: { x: number; y: number };
    coordinateSpace?: BrowserClickCoordinateSpace;
    button?: BrowserClickButton;
    clickCount?: 1 | 2;
  }): Promise<BrowserActionResult>;
  clickLocatedDomElement(input: {
    targetLabel: string;
    point: { x: number; y: number };
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  textInput(input: {
    targetLabel: string;
    action: BrowserTextInputAction;
    text?: string | null;
    key?: BrowserTextInputKey | null;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  screenshotRegion(input: { regionLabel: string; contentLines?: string[]; captureProfile?: BrowserScreenshotProfile; abortSignal?: AbortSignal }): Promise<BrowserCaptureResult>;
  evaluateActiveTab<T>(input: {
    script: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<T>;
  setFileInputFiles(input: {
    elementRef: BrowserFileInputRef;
    filePath: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  wait(durationMs: number): Promise<BrowserActionResult>;
  closeActiveTab(input: { reason: string; abortSignal?: AbortSignal }): Promise<BrowserActionResult>;
  close(): Promise<BrowserActionResult>;
}

export type { BrowserActionResult, BrowserCaptureResult, BrowserStateSnapshot, BrowserGeometrySnapshot, BrowserClickCoordinateSpace, BrowserScrollCoordinateSpace, BrowserTextInputAction, BrowserTextInputKey, BrowserOpenReusePolicy, BrowserController };
