import type { DomElementRef } from "./dom-automation.js";

export type ReadDomSnapshotInput = {
  includeFrames?: boolean | undefined;
  includeHidden?: false;
  maxTextLengthPerNode?: number | undefined;
  targetScope?: "active-tab" | "current-frame" | undefined;
};

export type LocateDomElementInput = {
  snapshot: import("./dom-automation.js").DomSnapshot;
  targetKind: DomElementRef["targetKind"];
  hints: string[];
  requiredText?: string | undefined;
  frameHint?: string | undefined;
  proximityAnchorText?: string | undefined;
};

export type FillDomElementInput = {
  elementRef: DomElementRef;
  approvedText: string;
  clearBeforeType: boolean;
  inputPurpose: string;
};

export type ClickDomElementInput = {
  elementRef: DomElementRef;
  expectedKind: string;
  expectedText?: string | undefined;
  waitAfterMs?: number | undefined;
};

export type UploadApprovedFileInput = {
  elementRef: DomElementRef;
  approvedFilePath: string;
  approvedTaskFilePath: string;
  allowedExtensions: string[];
  uploadPurpose: string;
};

export type ScrollToElementInput = {
  elementRef: DomElementRef;
  scrollBudget?: { maxPixels?: number | undefined; maxSteps?: number | undefined } | undefined;
  stickyHeaderOffset?: number | undefined;
  scrollPurpose: string;
};

export type SelectOptionInput = {
  elementRef: DomElementRef;
  approvedOptionText: string;
  matchMode: "exact" | "contains";
  approvedOptionList?: string[] | undefined;
  selectPurpose: string;
};

export type DismissOverlayInput = {
  overlayType:
    | "cookie-consent-overlay"
    | "promotional-overlay"
    | "informational-banner"
    | "gdpr-consent"
    | "app-install-prompt"
    | "modal-dialog"
    | "drawer-panel";
  approvedDismissalText: string;
  dismissPurpose: string;
};

export type VerifyDomStateInput = {
  snapshot: import("./dom-automation.js").DomSnapshot;
  expectedStates: Array<"file-selected" | "success-message" | "error-message" | "login-required" | "captcha-or-2fa-required">;
  successHints?: string[] | undefined;
  failureHints?: string[] | undefined;
};

export type WaitForDomStateInput = Omit<VerifyDomStateInput, "snapshot"> & {
  initialSnapshot?: import("./dom-automation.js").DomSnapshot | undefined;
  timeoutMs?: number | undefined;
  pollIntervalMs?: number | undefined;
};
