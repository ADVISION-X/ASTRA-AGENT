import type { LocalBrowserSessionState } from "../../types/local-browser-session.js";

import { createId } from "../local-runtime/ids.js";

type BrowserActionResult = {
  browserActionId: string;
  ok: boolean;
  message: string;
  createdAt: string;
  actionKind?: "open";
  requestedHost?: string;
  reusePolicy?: BrowserOpenReusePolicy;
  navigationMode?: BrowserOpenNavigationMode;
  observedUrl?: string;
  observedUrlMatchesRequest?: boolean;
  startedAt?: string;
  durationMs?: number;
};

type BrowserOpenNavigationMode =
  | "focused_existing_tab"
  | "focused_existing_same_path_tab"
  | "opened_new_window"
  | "opened_new_tab"
  | "opened_new_host_tab"
  | "reused_active_tab"
  | "reused_host_tab"
  | "no_existing_tab"
  | "unknown";

type BrowserOpenResult = BrowserActionResult & {
  actionKind: "open";
  requestedHost: string;
  reusePolicy: BrowserOpenReusePolicy;
  navigationMode: BrowserOpenNavigationMode;
  observedUrl: string;
  observedUrlMatchesRequest: boolean;
  startedAt: string;
  durationMs: number;
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
type BrowserOpenReusePolicy = "reuse-exact-url" | "focus-existing-exact-url" | "focus-existing-same-path-url" | "open-new-tab" | "reuse-active-tab" | "reuse-host-tab";

type BrowserFileInputRef = {
  selector: string;
  targetKind: "file-input";
};

type BrowserNativeMultiFilePickerResult = BrowserActionResult & {
  observedFileNames: string[];
};

interface BrowserController {
  setExecutionAbortSignal?(abortSignal: AbortSignal | null): void;
  getHealth(): { ok: boolean; detail: string };
  getSessionState(): BrowserStateSnapshot;
  getGeometrySnapshot(abortSignal?: AbortSignal): Promise<BrowserGeometrySnapshot>;
  open(input: {
    url: string;
    title: string;
    reusePolicy?: BrowserOpenReusePolicy;
    browserActionId?: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
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
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  move?(input: {
    targetLabel: string;
    point: { x: number; y: number };
    coordinateSpace?: BrowserClickCoordinateSpace;
    abortSignal?: AbortSignal;
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
    timeoutMs?: number;
  }): Promise<T>;
  setFileInputFiles(input: {
    elementRef: BrowserFileInputRef;
    filePath: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  selectFilesInNativePicker?(input: {
    stagingDirectoryPath: string;
    expectedFileNames: string[];
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserNativeMultiFilePickerResult>;
  wait(durationMs: number, abortSignal?: AbortSignal): Promise<BrowserActionResult>;
  closeActiveTab(input: { reason: string; abortSignal?: AbortSignal }): Promise<BrowserActionResult>;
  close(): Promise<BrowserActionResult>;
}

export type { BrowserActionResult, BrowserOpenResult, BrowserOpenNavigationMode, BrowserCaptureResult, BrowserStateSnapshot, BrowserGeometrySnapshot, BrowserClickCoordinateSpace, BrowserScrollCoordinateSpace, BrowserTextInputAction, BrowserTextInputKey, BrowserOpenReusePolicy, BrowserNativeMultiFilePickerResult, BrowserController };
