import type { BrowserAuthorityCertificateV1 } from "./infrastructure/browser-authority-certificate.js";
import type { BrowserFileArtifactGrantV1 } from "./exact-target/browser-file-artifact-grant.js";
import type {
  BrowserDocumentRef,
  BrowserTargetRef,
  ControlledBrowserTarget,
} from "./exact-target/browser-target-ref.js";

export type BrowserHash = `sha256:${string}`;

export type BrowserExecutionBinding = Readonly<{
  kind: "local" | "xuanxue";
  executionRef: string;
  jobRefHash: BrowserHash;
  executionRefHash: BrowserHash;
  writerLeaseEpoch: number;
  writerFenceHash: BrowserHash;
  candidateHash: BrowserHash;
}>;

export type BrowserAuthorityStatus =
  | Readonly<{ kind: "UNAVAILABLE"; reasonCode: string }>
  | Readonly<{
      kind: "AVAILABLE";
      authorityRefHash: BrowserHash;
      certificateHash: BrowserHash;
      activationTupleHash: BrowserHash;
    }>;

export type BrowserActionResult = Readonly<{
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
}>;

export type BrowserOpenReusePolicy =
  | "reuse-exact-url"
  | "bind-existing-exact-url"
  | "bind-existing-exact-origin"
  | "open-new-tab";

export type BrowserOpenNavigationMode =
  "acquired_exact_target" | "navigated_exact_target";

export type BrowserOpenResult = BrowserActionResult;

export type BrowserCaptureResult = Readonly<{
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
}>;

export type BrowserTargetLeaseState = Readonly<{
  leaseRef: string;
  ownerId: string;
  authorityRefHash: BrowserHash;
  authorityEpoch: number;
  executionBindingHash: BrowserHash;
  profileRef: string;
  currentUrl: string;
  currentTitle: string;
  lifecycle: "ATTACHED" | "NAVIGATING" | "TAKEN_OVER" | "DETACHED" | "CLOSED";
}>;

export type BrowserGeometrySnapshot = Readonly<{
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
}>;

export type BrowserClickCoordinateSpace = "browserViewport";
export type BrowserScrollCoordinateSpace = "browserViewport";
export type BrowserTextInputAction = "type-text" | "clear-input" | "press-key";
export type BrowserTextInputKey =
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

export type BrowserDomElementIdentity = Readonly<{
  tagName?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  labelText?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  visibleText?: string;
  testId?: string;
}>;

export type BrowserLocatedDomElement = Readonly<{
  selector: string;
  identity: BrowserDomElementIdentity;
}>;

export type BrowserFileInputRef = Readonly<{
  selector: string;
  targetKind: "file-input";
}>;

export type BrowserObservationCapabilityId =
  | "dom.snapshot.structural.v1"
  | "video.media-probe.universal.v1"
  | "video.media-probe.tiktok.v1"
  | "video.media-probe.facebook.v1";

export interface BrowserTargetLease {
  readonly leaseRef: string;
  readonly ownerId: string;
  readonly executionBinding: BrowserExecutionBinding;
  getTarget(): ControlledBrowserTarget | null;
  getHealth(): { ok: boolean; detail: string };
  getLeaseState(): BrowserTargetLeaseState;
  setExecutionAbortSignal(abortSignal: AbortSignal | null): void;
  releaseTargetForOperator(input: {
    reason: string;
  }): Promise<BrowserActionResult>;
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
    button?: "left" | "right" | "middle";
    clickCount?: 1 | 2;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  move(input: {
    targetLabel: string;
    point: { x: number; y: number };
    coordinateSpace?: BrowserClickCoordinateSpace;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  clickLocatedDomElement(input: {
    targetLabel: string;
    element: BrowserLocatedDomElement;
    expectedText?: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  fillLocatedDomElement(input: {
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
    captureProfile?: "default" | "observation_lightweight";
    abortSignal?: AbortSignal;
  }): Promise<BrowserCaptureResult>;
  observeCapability<T>(input: {
    capabilityId: BrowserObservationCapabilityId;
    abortSignal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<T>;
  setFileInputArtifact(input: {
    elementRef: BrowserFileInputRef;
    grant: BrowserFileArtifactGrantV1;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
  getGeometrySnapshot(
    abortSignal?: AbortSignal,
  ): Promise<BrowserGeometrySnapshot>;
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

export interface AuthenticatedBrowserAuthorityLease {
  readonly leaseRef: string;
  readonly certificate: BrowserAuthorityCertificateV1;
  readonly executionBinding: BrowserExecutionBinding;
  acquireTargetLease(ownerId: string): BrowserTargetLease;
  issueFileArtifactGrant(input: {
    artifactRef: string;
    sourcePath: string;
    expectedSha256?: BrowserHash;
    maxBytes?: number;
  }): Promise<BrowserFileArtifactGrantV1>;
  release(): Promise<void>;
}

export interface BrowserAuthorityBroker {
  currentStatus(): BrowserAuthorityStatus;
  acquireForExecution(
    binding: BrowserExecutionBinding,
  ): Promise<AuthenticatedBrowserAuthorityLease>;
}
