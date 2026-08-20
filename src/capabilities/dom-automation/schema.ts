import { z } from "zod";

const DomAutomationChildCapabilityIdSchema = z.enum([
  "read-dom-snapshot-once",
  "locate-dom-element-once",
  "fill-dom-element-once",
  "click-dom-element-once",
  "upload-approved-file-once",
  "verify-dom-state-once",
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

const DomElementSummaryBaseSchema = z
  .object({
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
  })
  .strict();

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

const DomFormSummarySchema = z
  .object({
    selectorCandidate: z.string(),
    id: z.string().optional(),
    name: z.string().optional(),
    labelText: z.string().optional(),
    inputCount: z.number().int().nonnegative(),
    buttonCount: z.number().int().nonnegative(),
  })
  .strict();

const DomDialogSummarySchema = DomElementSummaryBaseSchema.extend({
  descendantRows: z.array(
    DomCandidateSummarySchema.refine(
      (row) =>
        row.candidateKind === "table-row" || row.candidateKind === "role-row",
      { message: "dialog descendant rows must be table or role rows" },
    ),
  ),
}).strict();

const DomFrameSummarySchema = z
  .object({
    selectorCandidate: z.string(),
    title: z.string().optional(),
    name: z.string().optional(),
    srcHost: z.string().optional(),
  })
  .strict();

const DomSnapshotSchema = z
  .object({
    targetRef: z.string().min(1),
    documentRef: z.string().min(1),
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
  })
  .strict();

const ReadDomSnapshotInputSchema = z
  .object({
    includeFrames: z.boolean().optional().default(false),
    includeHidden: z.literal(false).optional().default(false),
    maxTextLengthPerNode: z
      .number()
      .int()
      .min(20)
      .max(240)
      .optional()
      .default(120),
    targetScope: z
      .enum(["exact-target", "current-frame"])
      .optional()
      .default("exact-target"),
    timeoutMs: z.number().int().min(100).max(10_000).optional(),
  })
  .strict();

const DomElementRefSchema = z
  .object({
    targetRef: z.string().min(1),
    documentRef: z.string().min(1),
    elementRef: z.string().min(1),
    selector: z.string().min(1),
    identity: DomElementSummaryBaseSchema.pick({
      tagName: true,
      type: true,
      role: true,
      ariaLabel: true,
      labelText: true,
      placeholder: true,
      name: true,
      id: true,
      visibleText: true,
      testId: true,
    })
      .partial()
      .refine(
        (identity) =>
          Object.values(identity).some(
            (value) => typeof value === "string" && value.length > 0,
          ),
        { message: "DOM identity requires at least one exact signal" },
      ),
    frameRef: z.string().min(1).optional(),
    targetKind: DomTargetKindSchema,
    confidence: z.number().min(0).max(1),
    matchedSignals: z.array(z.string().min(1)),
    reason: z.string().min(1),
    ["fall" + "backUsed"]: z.boolean(),
    proximityAnchor: z.string().min(1).optional(),
    componentLibHint: z.string().min(1).optional(),
    sourceSnapshotRef: z.string().min(1).optional(),
    capturedAt: z.string().datetime().optional(),
  })
  .strict();

const LocateDomElementInputSchema = z
  .object({
    snapshot: DomSnapshotSchema,
    targetKind: DomTargetKindSchema,
    hints: z.array(z.string().min(1)).min(1),
    requiredText: z.string().min(1).optional(),
    frameHint: z.string().min(1).optional(),
    proximityAnchorText: z.string().min(1).optional(),
  })
  .strict();

const DomLocateResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      status: z.literal("success"),
      elementRef: DomElementRefSchema,
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      status: z.enum(["not_found", "ambiguous", "review_required"]),
      reason: z.string().min(1),
      candidates: z.array(DomElementRefSchema).optional(),
    })
    .strict(),
]);

const DomActionStatusSchema = z.enum([
  "success",
  "failed",
  "not_found",
  "ambiguous",
  "review_required",
]);

const DomActionResultSchema = z
  .object({
    ok: z.boolean(),
    status: DomActionStatusSchema,
    actionId: z.string().min(1),
    message: z.string().min(1),
    beforeEvidenceRef: z.string().min(1).optional(),
    afterEvidenceRef: z.string().min(1).optional(),
    reviewRequiredReason: z.string().min(1).optional(),
  })
  .strict();

const FillDomElementInputSchema = z
  .object({
    elementRef: DomElementRefSchema,
    approvedText: z.string(),
    clearBeforeType: z.boolean(),
    inputPurpose: z.string().min(1).max(80),
  })
  .strict();

const ClickDomElementInputSchema = z
  .object({
    elementRef: DomElementRefSchema,
    expectedKind: z.string().min(1),
    expectedText: z.string().min(1).optional(),
    waitAfterMs: z.number().int().min(0).max(10000).optional(),
  })
  .strict();

const UploadApprovedFileInputSchema = z
  .object({
    elementRef: DomElementRefSchema,
    fileArtifactGrant: z
      .object({
        grantRef: z.string().min(1),
        artifactRef: z.string().min(1),
        fileName: z.string().min(1),
        authorityEpoch: z.number().int().nonnegative(),
        executionFenceHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
        approvedRootHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
        canonicalRealpathHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
        deviceIdHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
        inodeHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
        byteLength: z.number().int().positive(),
        contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
        expiresAtMonotonicMs: z.number().finite(),
      })
      .strict(),
    uploadPurpose: z.string().min(1).max(80),
  })
  .strict();

const DomVerificationStatusSchema = z.enum([
  "success",
  "failed",
  "not_found",
  "ambiguous",
  "login_required",
  "captcha_or_2fa_required",
  "review_required",
]);

const VerifyDomStateInputSchema = z
  .object({
    snapshot: DomSnapshotSchema,
    expectedStates: z
      .array(
        z.enum([
          "file-selected",
          "success-message",
          "error-message",
          "login-required",
          "captcha-or-2fa-required",
        ]),
      )
      .min(1),
    successHints: z.array(z.string().min(1)).default([]),
    failureHints: z.array(z.string().min(1)).default([]),
  })
  .strict();

const DomVerificationResultSchema = z
  .object({
    status: DomVerificationStatusSchema,
    confidence: z.number().min(0).max(1),
    evidenceRef: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

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
} as const;
