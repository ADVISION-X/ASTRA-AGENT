import type { LocalBrowserSessionState } from "../../types/local-browser-session.js";

import type {
  BrowserDocumentRef,
  BrowserTargetRef,
  ControlledBrowserTarget,
} from "./exact-target/browser-target-ref.js";

type BrowserActionResult = {
  browserActionId: string;
  ok: boolean;
  message: string;
  createdAt: string;
  targetRef?: BrowserTargetRef;
  documentRef?: BrowserDocumentRef;
  observedUrl?: string;
  startedAt?: string;
  durationMs?: number;
  actionKind?: "open";
  requestedHost?: string;
  reusePolicy?: BrowserOpenReusePolicy;
  navigationMode?: BrowserOpenNavigationMode | string;
  observedUrlMatchesRequest?: boolean;
  focusLeaseId?: string;
};

type BrowserOpenReusePolicy =
  | "reuse-exact-url"
  | "bind-existing-exact-url"
  | "bind-existing-exact-origin"
  | "open-new-tab";

type BrowserOpenNavigationMode =
  "acquired_exact_target" | "navigated_exact_target";

type BrowserOpenResult = BrowserActionResult;

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
  targetRef?: BrowserTargetRef;
  documentRef?: BrowserDocumentRef;
};

type BrowserScreenshotProfile = "default" | "observation_lightweight";

type BrowserStateSnapshot = LocalBrowserSessionState & {
  open: boolean;
  currentUrl: string;
  currentTitle: string;
  browserExecutable: string | null;
  exactTargetCount?: number;
  transportReady?: boolean;
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
  visibleContentBounds: { x: number; y: number; width: number; height: number };
  capturedAt: string;
  targetRef?: BrowserTargetRef;
  documentRef?: BrowserDocumentRef;
};

type BrowserClickCoordinateSpace = "browserViewport";
type BrowserClickButton = "left" | "right" | "middle";
type BrowserScrollCoordinateSpace = "browserViewport";
type BrowserTextInputAction = "type-text" | "clear-input" | "press-key";
type BrowserTextInputKey =
  | "Enter"
  | "Tab"
  | "Escape"
  | "Backspace"
  | "Delete"
  | "L"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

type BrowserDomElementIdentity = {
  tagName?: string | undefined;
  type?: string | undefined;
  role?: string | undefined;
  ariaLabel?: string | undefined;
  labelText?: string | undefined;
  placeholder?: string | undefined;
  name?: string | undefined;
  id?: string | undefined;
  visibleText?: string | undefined;
  testId?: string | undefined;
};

type BrowserLocatedDomElement = {
  selector: string;
  identity: BrowserDomElementIdentity;
};

type BrowserFileInputRef = { selector: string; targetKind: "file-input" };

interface BrowserTargetSession {
  readonly ownerId?: string;
  getTarget?(): ControlledBrowserTarget | null;
  releaseTargetForOperator?(input: {
    reason: string;
  }): Promise<BrowserActionResult>;
  setExecutionAbortSignal?(abortSignal: AbortSignal | null): void;
  getHealth(): { ok: boolean; detail: string };
  getSessionState(): BrowserStateSnapshot;
  getGeometrySnapshot(
    abortSignal?: AbortSignal,
  ): Promise<BrowserGeometrySnapshot>;
  open(input: {
    url: string;
    title: string;
    reusePolicy?: BrowserOpenReusePolicy;
    browserActionId?: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserOpenResult>;
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
    element: BrowserLocatedDomElement;
    expectedText?: string | undefined;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  fillLocatedDomElement?(input: {
    targetLabel: string;
    element: BrowserLocatedDomElement;
    approvedText: string;
    clearBeforeType: boolean;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  textInput(input: {
    targetLabel: string;
    action: BrowserTextInputAction;
    text?: string | null;
    key?: BrowserTextInputKey | null;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  screenshotRegion(input: {
    regionLabel: string;
    contentLines?: string[];
    captureProfile?: BrowserScreenshotProfile;
    abortSignal?: AbortSignal;
  }): Promise<BrowserCaptureResult>;
  evaluate<T>(input: {
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
  wait(
    durationMs: number,
    abortSignal?: AbortSignal,
  ): Promise<BrowserActionResult>;
  closeTarget(input: {
    reason: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  close(): Promise<BrowserActionResult>;
}

interface BrowserController {
  setExecutionAbortSignal?(abortSignal: AbortSignal | null): void;
  getHealth(): { ok: boolean; detail: string };
  getSessionState(): BrowserStateSnapshot;
  createTargetSession(ownerId: string): BrowserTargetSession;
  close(): Promise<{
    browserActionId: string;
    ok: boolean;
    message: string;
    createdAt: string;
  }>;
}

export type {
  BrowserActionResult,
  BrowserOpenResult,
  BrowserOpenNavigationMode,
  BrowserCaptureResult,
  BrowserStateSnapshot,
  BrowserGeometrySnapshot,
  BrowserClickCoordinateSpace,
  BrowserScrollCoordinateSpace,
  BrowserTextInputAction,
  BrowserTextInputKey,
  BrowserDomElementIdentity,
  BrowserLocatedDomElement,
  BrowserOpenReusePolicy,
  BrowserTargetSession,
  BrowserController,
};
