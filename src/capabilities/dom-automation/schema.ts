import { z } from "zod";

const DomAutomationChildCapabilityIdSchema = z.enum([
  "read-dom-snapshot-once",
  "locate-dom-element-once",
  "fill-dom-element-once",
  "click-dom-element-once",
  "upload-approved-file-once",
  "verify-dom-state-once",
  "wait-for-dom-state-once",
]);

const DomTargetKindSchema = z.enum([
  "text-input",
  "search-input",
  "button",
  "link",
  "file-input",
  "row",
  "clickable",
  "message",
  "dialog",
  "select",
  "combobox",
  "dropdown-trigger",
  "overlay-dismiss-button",
  "tab-button",
  "rich-text-editor",
]);

const DomDetectedStateSchema = z.enum([
  "login_required",
  "captcha_or_2fa_required",
  "file_selected",
  "success_message",
  "error_message",
  "cookie-consent-overlay",
  "promotional-overlay",
  "modal-dialog",
  "drawer-panel",
  "loading-skeleton",
  "empty-state",
  "error-state",
  "rate-limited",
]);

const DomElementSummaryBaseSchema = z.object({
  tagName: z.string(),
  type: z.string().optional(),
  role: z.string().optional(),
  ariaLabel: z.string().optional(),
  labelText: z.string().optional(),
  placeholder: z.string().optional(),
  name: z.string().optional(),
  id: z.string().optional(),
  visibleText: z.string().optional(),
  nearbyText: z.string().optional(),
  disabled: z.boolean(),
  hidden: z.boolean(),
  selectorCandidate: z.string(),
  formId: z.string().optional(),
  testId: z.string().optional(),
}).strict();

const DomInputSummarySchema = DomElementSummaryBaseSchema.extend({
  tagName: z.string(),
  type: z.string(),
  valuePreview: z.string().optional(),
}).strict();

const DomButtonSummarySchema = DomElementSummaryBaseSchema.strict();
const DomLinkSummarySchema = DomElementSummaryBaseSchema.extend({
  hrefHost: z.string().optional(),
}).strict();
const DomFileInputSummarySchema = DomElementSummaryBaseSchema.extend({
  type: z.literal("file"),
  accept: z.string().optional(),
}).strict();
const DomCandidateSummarySchema = DomElementSummaryBaseSchema.extend({
  candidateKind: z.enum([
    "table-row",
    "role-row",
    "text-block",
    "clickable",
    "dropdown-trigger",
    "overlay",
    "loading-indicator",
    "sticky-element",
  ]),
}).strict();

const DomFormSummarySchema = z.object({
  selectorCandidate: z.string(),
  id: z.string().optional(),
  name: z.string().optional(),
  labelText: z.string().optional(),
  inputCount: z.number().int().nonnegative(),
  buttonCount: z.number().int().nonnegative(),
}).strict();

const DomDialogSummarySchema = DomElementSummaryBaseSchema.strict();

const DomFrameSummarySchema = z.object({
  selectorCandidate: z.string(),
  title: z.string().optional(),
  name: z.string().optional(),
  srcHost: z.string().optional(),
}).strict();

const DomSnapshotSchema = z.object({
  url: z.string(),
  title: z.string(),
  forms: z.array(DomFormSummarySchema),
  inputs: z.array(DomInputSummarySchema),
  buttons: z.array(DomButtonSummarySchema),
  links: z.array(DomLinkSummarySchema),
  fileInputs: z.array(DomFileInputSummarySchema),
  dialogs: z.array(DomDialogSummarySchema),
  frames: z.array(DomFrameSummarySchema),
  textBlocks: z.array(DomCandidateSummarySchema),
  tableRows: z.array(DomCandidateSummarySchema),
  roleRows: z.array(DomCandidateSummarySchema),
  genericClickableElements: z.array(DomCandidateSummarySchema),
  dropdownTriggers: z.array(DomCandidateSummarySchema),
  overlays: z.array(DomCandidateSummarySchema),
  loadingIndicators: z.array(DomCandidateSummarySchema),
  stickyElements: z.array(DomCandidateSummarySchema),
  detectedStates: z.array(DomDetectedStateSchema),
  capturedAt: z.string().datetime(),
}).strict();

const ReadDomSnapshotInputSchema = z.object({
  includeFrames: z.boolean().optional().default(false),
  includeHidden: z.literal(false).optional().default(false),
  maxTextLengthPerNode: z.number().int().min(20).max(240).optional().default(120),
  targetScope: z.enum(["active-tab", "current-frame"]).optional().default("active-tab"),
}).strict();

const DomElementRefSchema = z.object({
  elementRef: z.string().min(1),
  selector: z.string().min(1),
  frameRef: z.string().min(1).optional(),
  targetKind: DomTargetKindSchema,
  confidence: z.number().min(0).max(1),
  matchedSignals: z.array(z.string().min(1)),
  reason: z.string().min(1),
  ["fall" + "backUsed"]: z.boolean(),
  proximityAnchor: z.string().min(1).optional(),
  componentLibHint: z.string().min(1).optional(),
  sourceSnapshotRef: z.string().min(1).optional(),
  textFingerprint: z.string().min(1).optional(),
  capturedAt: z.string().datetime().optional(),
}).strict();

const LocateDomElementInputSchema = z.object({
  snapshot: DomSnapshotSchema,
  targetKind: DomTargetKindSchema,
  hints: z.array(z.string().min(1)).min(1),
  requiredText: z.string().min(1).optional(),
  frameHint: z.string().min(1).optional(),
  proximityAnchorText: z.string().min(1).optional(),
}).strict();

const DomLocateResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    status: z.literal("success"),
    elementRef: DomElementRefSchema,
  }).strict(),
  z.object({
    ok: z.literal(false),
    status: z.enum(["not_found", "ambiguous", "review_required"]),
    reason: z.string().min(1),
    candidates: z.array(DomElementRefSchema).optional(),
  }).strict(),
]);

const DomActionStatusSchema = z.enum([
  "success",
  "failed",
  "not_found",
  "ambiguous",
  "review_required",
]);

const DomActionResultSchema = z.object({
  ok: z.boolean(),
  status: DomActionStatusSchema,
  actionId: z.string().min(1),
  message: z.string().min(1),
  beforeEvidenceRef: z.string().min(1).optional(),
  afterEvidenceRef: z.string().min(1).optional(),
  reviewRequiredReason: z.string().min(1).optional(),
}).strict();

const FillDomElementInputSchema = z.object({
  elementRef: DomElementRefSchema,
  approvedText: z.string(),
  clearBeforeType: z.boolean(),
  inputPurpose: z.string().min(1).max(80),
}).strict();

const ClickDomElementInputSchema = z.object({
  elementRef: DomElementRefSchema,
  expectedKind: z.string().min(1),
  expectedText: z.string().min(1).optional(),
  waitAfterMs: z.number().int().min(0).max(10000).optional(),
}).strict();

const UploadApprovedFileInputSchema = z.object({
  elementRef: DomElementRefSchema,
  approvedFilePath: z.string().min(1),
  approvedTaskFilePath: z.string().min(1),
  allowedExtensions: z.array(z.string().regex(/^\.[a-z0-9]+$/i)).min(1).max(8),
  uploadPurpose: z.string().min(1).max(80),
}).strict();

const DomVerificationStatusSchema = z.enum([
  "success",
  "failed",
  "not_found",
  "ambiguous",
  "login_required",
  "captcha_or_2fa_required",
  "review_required",
]);

const VerifyDomStateInputSchema = z.object({
  snapshot: DomSnapshotSchema,
	  expectedStates: z.array(z.enum([
    "file-selected",
    "success-message",
    "error-message",
    "login-required",
    "captcha-or-2fa-required",
  ])).min(1),
  successHints: z.array(z.string().min(1)).default([]),
  failureHints: z.array(z.string().min(1)).default([]),
}).strict();

const DomVerificationResultSchema = z.object({
  status: DomVerificationStatusSchema,
  confidence: z.number().min(0).max(1),
  evidenceRef: z.string().min(1),
  reason: z.string().min(1),
}).strict();

const WaitForDomStateInputSchema = z.object({
  initialSnapshot: DomSnapshotSchema.optional(),
	  expectedStates: z.array(z.enum([
    "file-selected",
    "success-message",
    "error-message",
    "login-required",
    "captcha-or-2fa-required",
  ])).min(1),
  successHints: z.array(z.string().min(1)).default([]),
  failureHints: z.array(z.string().min(1)).default([]),
  timeoutMs: z.number().int().min(100).max(30000).default(5000),
  pollIntervalMs: z.number().int().min(50).max(5000).default(500),
}).strict();

export const DOM_SCHEMAS = {
  DomActionResult: DomActionResultSchema,
  DomAutomationChildCapabilityId: DomAutomationChildCapabilityIdSchema,
  DomElementRef: DomElementRefSchema,
  DomLocateResult: DomLocateResultSchema,
  DomSnapshot: DomSnapshotSchema,
  DomVerificationResult: DomVerificationResultSchema,
  ClickDomElementInput: ClickDomElementInputSchema,
  FillDomElementInput: FillDomElementInputSchema,
  LocateDomElementInput: LocateDomElementInputSchema,
  ReadDomSnapshotInput: ReadDomSnapshotInputSchema,
  UploadApprovedFileInput: UploadApprovedFileInputSchema,
  VerifyDomStateInput: VerifyDomStateInputSchema,
  WaitForDomStateInput: WaitForDomStateInputSchema,
} as const;
