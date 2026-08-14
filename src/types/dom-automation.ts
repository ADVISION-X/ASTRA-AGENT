type DomTargetKind =
  | "text-input" | "search-input" | "button" | "link" | "file-input"
  | "row" | "clickable" | "message" | "dialog" | "select" | "combobox"
  | "dropdown-trigger" | "overlay-dismiss-button" | "tab-button" | "rich-text-editor";

type DomElementSummary = {
  tagName: string;
  type?: string | undefined;
  role?: string | undefined;
  ariaLabel?: string | undefined;
  labelText?: string | undefined;
  placeholder?: string | undefined;
  name?: string | undefined;
  id?: string | undefined;
  visibleText?: string | undefined;
  nearbyText?: string | undefined;
  disabled: boolean;
  hidden: boolean;
  selectorCandidate: string;
  formId?: string | undefined;
  testId?: string | undefined;
};

export type DomElementRef = {
  targetRef: BrowserTargetRef;
  documentRef: BrowserDocumentRef;
  elementRef: string;
  selector: string;
  frameRef?: string | undefined;
  targetKind: DomTargetKind;
  confidence: number;
  matchedSignals: string[];
  reason: string;
  "fall\u0062ackUsed": boolean;
  proximityAnchor?: string | undefined;
  componentLibHint?: string | undefined;
  sourceSnapshotRef?: string | undefined;
  textFingerprint?: string | undefined;
  capturedAt?: string | undefined;
};

export type DomSnapshot = {
  targetRef: BrowserTargetRef;
  documentRef: BrowserDocumentRef;
  url: string;
  title: string;
  forms: Array<{ selectorCandidate: string; id?: string | undefined; name?: string | undefined; labelText?: string | undefined; inputCount: number; buttonCount: number }>;
  inputs: Array<DomElementSummary & { type: string; valuePreview?: string | undefined }>;
  buttons: DomElementSummary[];
  links: Array<DomElementSummary & { hrefHost?: string | undefined }>;
  fileInputs: Array<DomElementSummary & { type: "file"; accept?: string | undefined }>;
  dialogs: DomElementSummary[];
  frames: Array<{ selectorCandidate: string; title?: string | undefined; name?: string | undefined; srcHost?: string | undefined }>;
  textBlocks: Array<DomElementSummary & { candidateKind: string }>;
  tableRows: Array<DomElementSummary & { candidateKind: string }>;
  roleRows: Array<DomElementSummary & { candidateKind: string }>;
  genericClickableElements: Array<DomElementSummary & { candidateKind: string }>;
  dropdownTriggers: Array<DomElementSummary & { candidateKind: string }>;
  overlays: Array<DomElementSummary & { candidateKind: string }>;
  loadingIndicators: Array<DomElementSummary & { candidateKind: string }>;
  stickyElements: Array<DomElementSummary & { candidateKind: string }>;
  detectedStates: string[];
  capturedAt: string;
};

export type DomActionResult = {
  ok: boolean;
  status: "success" | "failed" | "not_found" | "ambiguous" | "review_required";
  actionId: string;
  message: string;
  beforeEvidenceRef?: string | undefined;
  afterEvidenceRef?: string | undefined;
  reviewRequiredReason?: string | undefined;
};

export type DomVerificationResult = {
  status: "success" | "failed" | "not_found" | "ambiguous" | "login_required" | "captcha_or_2fa_required" | "review_required";
  confidence: number;
  evidenceRef: string;
  reason: string;
};

export type DomLocateResult =
  | { ok: true; status: "success"; elementRef: DomElementRef }
  | { ok: false; status: "not_found" | "ambiguous" | "review_required"; reason: string; candidates?: DomElementRef[] };
import type { BrowserDocumentRef, BrowserTargetRef } from "./browser-target.js";
