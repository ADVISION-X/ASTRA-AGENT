import { z } from "zod";

import {
  SCREENSHOT_ABILITY_GROUP_ID,
  SCREENSHOT_CHILD_CAPABILITY_IDS,
  SCREENSHOT_COORDINATE_SPACES,
  SCREENSHOT_DATA_QUALITY_FLAGS,
  SCREENSHOT_DECISION_STATUSES,
  SCREENSHOT_EVIDENCE_POLICIES,
  SCREENSHOT_FAILURE_CODES,
  SCREENSHOT_IMAGE_KINDS,
  SCREENSHOT_PAGE_STATE_STATUSES,
  SCREENSHOT_RESULT_STATUSES,
  SCREENSHOT_SENSITIVE_SCREEN_STATUSES,
  SCREENSHOT_SOURCE_KINDS,
} from "./shared/screenshot-types.js";
import {
  SCREENSHOT_RESULT_CHAIN_FIELD_NAMES,
  ScreenshotInputGovernanceShape,
  ScreenshotProofGovernanceShape,
  ScreenshotResultGovernanceShape,
} from "./shared/screenshot-governance.js";
import {
  ScreenshotArtifactBudgetPolicySchema,
  ScreenshotArtifactBudgetSnapshotSchema,
  ScreenshotArtifactCleanupGateSchema,
  ScreenshotArtifactLifecycleManifestSchema,
  ScreenshotPromotionStatusSchema,
  ScreenshotRetentionClassSchema,
} from "./shared/screenshot-artifact-lifecycle-schema.js";
import {
  DEFAULT_AI_INPUT_MAX_WIDTH,
  DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_POLICY,
  DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_SNAPSHOT,
} from "./shared/screenshot-policy.js";
import { validateScreenshotResult, validateScreenshotRuntimeProofCore, validateScreenshotRuntimeProofPrepareAiInput } from "./screenshot-schema-refinements.js";

const nullableString = z.string().min(1).nullable().optional().default(null);
const nullableBoolean = z.boolean().nullable().optional().default(null);
const nullableDateTimeString = z.string().datetime().nullable().optional().default(null);
const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();
const nonNegativeInt = z.number().int().nonnegative();
const requestedByString = z.string().min(1).max(120);
const purposeString = z.string().min(1).max(300);
const pageUrlString = z.string().min(1).max(2000).nullable().optional().default(null);
const pageTitleString = z.string().min(1).max(300).nullable().optional().default(null);
const sourceStorageRefString = z.string().min(1).max(1000);

const ScreenshotChildCapabilityIdSchema = z.enum(SCREENSHOT_CHILD_CAPABILITY_IDS);
const ScreenshotStatusSchema = z.enum(SCREENSHOT_RESULT_STATUSES);
const ScreenshotSourceKindSchema = z.enum(SCREENSHOT_SOURCE_KINDS);
const ScreenshotCoordinateSpaceSchema = z.enum(SCREENSHOT_COORDINATE_SPACES);
const ScreenshotImageKindSchema = z.enum(SCREENSHOT_IMAGE_KINDS);
const ScreenshotEvidencePolicySchema = z.enum(SCREENSHOT_EVIDENCE_POLICIES);
const ScreenshotFailureCodeSchema = z.enum(SCREENSHOT_FAILURE_CODES);
const ScreenshotDataQualityFlagSchema = z.enum(SCREENSHOT_DATA_QUALITY_FLAGS);
const ScreenshotDecisionStatusSchema = z.enum(SCREENSHOT_DECISION_STATUSES);
const ScreenshotPageStateStatusSchema = z.enum(SCREENSHOT_PAGE_STATE_STATUSES);

const ScreenshotFailureSchema = z.object({
  code: ScreenshotFailureCodeSchema,
  message: z.string().min(1),
  detail: nullableString,
}).strict();

const ScreenshotBoundingBoxSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
  sourceScreenshotEvidenceId: z.string().min(1),
  sourceStorageRef: z.string().min(1),
  coordinateSpace: ScreenshotCoordinateSpaceSchema.exclude(["ai_input_pixels"]),
}).strict();

const ScreenshotCaptureBoundsSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
}).strict();

const ScreenshotScaleMappingSchema = z.object({
  sourceScreenshotEvidenceId: nullableString,
  sourceStorageRef: nullableString,
  sourceCoordinateSpace: ScreenshotCoordinateSpaceSchema.exclude(["ai_input_pixels"]).nullable().optional().default(null),
  targetCoordinateSpace: ScreenshotCoordinateSpaceSchema,
  sourceWidth: positiveFiniteNumber.nullable().optional().default(null),
  sourceHeight: positiveFiniteNumber.nullable().optional().default(null),
  targetWidth: positiveFiniteNumber.nullable().optional().default(null),
  targetHeight: positiveFiniteNumber.nullable().optional().default(null),
  cropOffsetX: finiteNumber,
  cropOffsetY: finiteNumber,
  scaleX: positiveFiniteNumber,
  scaleY: positiveFiniteNumber,
}).strict();

const ScreenshotArtifactRefSchema = z.object({
  artifactId: z.string().min(1),
  evidenceId: z.string().min(1),
  storageRef: sourceStorageRefString,
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sha256: z.string().min(1),
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
  imageKind: ScreenshotImageKindSchema,
  createdAt: z.string().datetime(),
}).strict();

const ScreenshotStoredArtifactSchema = z.object({
  artifactRef: ScreenshotArtifactRefSchema,
  artifactLifecycleManifestRef: z.string().min(1),
  retentionClass: ScreenshotRetentionClassSchema,
  expiresAt: nullableDateTimeString,
  deleteAfter: nullableDateTimeString,
  artifactHash: z.string().min(1),
  byteSize: nonNegativeInt,
  promotionStatus: ScreenshotPromotionStatusSchema,
  cleanupEligible: z.boolean(),
}).strict();

const ScreenshotSourceProofSchema = z.object({
  proofRef: z.string().min(1),
  sourceKind: ScreenshotSourceKindSchema,
  sourceStorageRef: sourceStorageRefString.nullable().optional().default(null),
  sourceArtifactRef: ScreenshotArtifactRefSchema.nullable().optional().default(null),
  sourceScreenshotEvidenceId: nullableString,
  sourceHash: nullableString,
  coordinateSpace: ScreenshotCoordinateSpaceSchema.exclude(["ai_input_pixels"]).nullable().optional().default(null),
  sourceWidth: positiveFiniteNumber.nullable().optional().default(null),
  sourceHeight: positiveFiniteNumber.nullable().optional().default(null),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  capabilityCallId: nullableString,
  pageStateProofRef: nullableString,
  browserSessionRef: nullableString,
}).strict();

const ScreenshotCapturePolicySchema = z.object({
  allowMissingRoundId: z.boolean().default(true),
  allowMissingVideoVisitId: z.boolean().default(true),
  allowFirstCaptureWithoutPageStateProof: z.boolean().default(false),
  maxContentLines: z.number().int().positive().default(12),
  contentLineMaxLength: z.number().int().positive().default(200),
  maxAiWidth: positiveFiniteNumber.nullable().optional().default(DEFAULT_AI_INPUT_MAX_WIDTH),
  preservePixels: z.boolean().default(true),
  evidencePolicy: ScreenshotEvidencePolicySchema.default("evidence_original"),
  artifactBudget: ScreenshotArtifactBudgetPolicySchema.default(DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_POLICY),
  maxDurationMs: z.number().int().positive().default(10_000),
  onTimeoutStatus: ScreenshotStatusSchema.exclude(["success"]).default("failed"),
}).strict();

const ScreenshotPrivacyPolicySchema = z.object({
  operatorApprovalRef: nullableString,
  screenTarget: nullableString,
  captureBounds: ScreenshotCaptureBoundsSchema.nullable().optional().default(null),
  allowFullScreen: z.boolean().default(false),
  sensitiveScreenState: z.enum(SCREENSHOT_SENSITIVE_SCREEN_STATUSES).default("unknown"),
}).strict();

const ScreenshotPageStateProofSchema = z.object({
  proofRef: z.string().min(1),
  status: ScreenshotPageStateStatusSchema,
  pageUrl: pageUrlString,
  pageTitle: pageTitleString,
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  observedAt: z.string().datetime(),
}).strict();

const ScreenshotDecisionSchema = z.object({
  status: ScreenshotDecisionStatusSchema,
  reason: nullableString,
}).strict();

const ScreenshotBrowserSessionSnapshotSchema = z.object({
  open: z.boolean(),
  currentUrl: z.string().min(1).max(2000),
  currentTitle: pageTitleString,
  browserExecutable: nullableString,
  browserMode: z.enum(["real_chrome_persistent", "fixture", "unsupported"]),
  browserProfileRef: z.string().min(1),
  browserExecutablePath: nullableString,
  profileStatus: z.enum([
    "profile_ready",
    "profile_missing",
    "profile_locked",
    "profile_unavailable",
    "login_required",
    "logged_in",
    "unknown",
  ]),
  profileDirectory: z.string().min(1),
  profileProvisioning: z.enum(["operator_supplied", "managed_default"]),
  profileVerificationStatus: z.enum(["operator_verified", "default_unverified"]),
  profileVerificationReason: nullableString,
  loginState: z.enum(["unknown", "login_required", "logged_in", "review_required"]),
  lastLoginCheckAt: nullableString,
  loginRequiredReason: nullableString,
  reviewRequiredReason: nullableString,
}).strict();

const ScreenshotBrowserCaptureSchema = z.object({
  browserActionId: z.string().min(1),
  pageUrl: z.string().min(1).max(2000),
  pageTitle: pageTitleString,
  regionLabel: z.string().min(1),
  regionType: z.string().min(1),
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
  viewportWidth: positiveFiniteNumber,
  viewportHeight: positiveFiniteNumber,
  contentLines: z.array(z.string().min(1)).default([]),
  sourceFilePath: z.string().min(1),
  createdAt: z.string().datetime(),
}).strict();

const ScreenshotDesktopCaptureSchema = z.object({
  screenId: z.string().min(1),
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
  sourceFilePath: z.string().min(1),
  createdAt: z.string().datetime(),
}).strict();

const ScreenshotStoredImageSourceSchema = z.object({
  kind: z.literal("stored_image"),
  sourceStorageRef: sourceStorageRefString,
  sourceArtifactRef: ScreenshotArtifactRefSchema.nullable().optional().default(null),
  sourceProof: ScreenshotSourceProofSchema,
  coordinateSpace: ScreenshotCoordinateSpaceSchema.exclude(["ai_input_pixels"]).default("source_image_pixels"),
}).strict();

const ScreenshotBrowserViewportSourceSchema = z.object({
  kind: z.literal("browser_viewport"),
  pageUrl: pageUrlString,
  pageTitle: pageTitleString,
  browserSessionRef: nullableString,
}).strict();

const ScreenshotDesktopScreenSourceSchema = z.object({
  kind: z.literal("desktop_screen"),
  screenId: nullableString,
}).strict();

const ScreenshotBaseInputSchema = z.object({
  abilityGroupId: z.literal(SCREENSHOT_ABILITY_GROUP_ID).default(SCREENSHOT_ABILITY_GROUP_ID),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  ...ScreenshotInputGovernanceShape,
  requestedBy: requestedByString,
  purpose: purposeString,
  sourceAbilityGroupId: z.string().min(1).default("orchestration"),
  sourceChildCapabilityId: nullableString,
  region: ScreenshotBoundingBoxSchema.nullable().optional().default(null),
  maxAiWidth: positiveFiniteNumber.nullable().optional().default(null),
  preservePixels: z.boolean().default(true),
  evidencePolicy: ScreenshotEvidencePolicySchema.default("evidence_original"),
  contentLines: z.array(z.string().min(1)).default([]),
  sourceProof: ScreenshotSourceProofSchema.nullable().optional().default(null),
  pageStateProof: ScreenshotPageStateProofSchema.nullable().optional().default(null),
  artifactBudgetSnapshot: ScreenshotArtifactBudgetSnapshotSchema.default(DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_SNAPSHOT),
  privacyPolicy: ScreenshotPrivacyPolicySchema.default({
    operatorApprovalRef: null,
    screenTarget: null,
    captureBounds: null,
    allowFullScreen: false,
    sensitiveScreenState: "unknown",
  }),
  capturePolicy: ScreenshotCapturePolicySchema.default({
    allowMissingRoundId: true,
    allowMissingVideoVisitId: true,
    allowFirstCaptureWithoutPageStateProof: false,
    maxContentLines: 12,
    contentLineMaxLength: 200,
    maxAiWidth: DEFAULT_AI_INPUT_MAX_WIDTH,
    preservePixels: true,
    evidencePolicy: "evidence_original",
    artifactBudget: DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_POLICY,
    maxDurationMs: 10_000,
    onTimeoutStatus: "failed",
  }),
}).strict();

const CaptureBrowserViewportInputSchema = ScreenshotBaseInputSchema.extend({
  childCapabilityId: z.literal("capture-browser-viewport"),
  source: ScreenshotBrowserViewportSourceSchema.default({
    kind: "browser_viewport",
    pageUrl: null,
    pageTitle: null,
    browserSessionRef: null,
  }),
  region: z.null().optional().default(null),
}).strict();

const CaptureDesktopScreenInputSchema = ScreenshotBaseInputSchema.extend({
  childCapabilityId: z.literal("capture-desktop-screen"),
  source: ScreenshotDesktopScreenSourceSchema.default({
    kind: "desktop_screen",
    screenId: "primary",
  }),
  region: z.null().optional().default(null),
}).strict();

const CaptureRegionInputSchema = ScreenshotBaseInputSchema.extend({
  childCapabilityId: z.literal("capture-region"),
  source: ScreenshotStoredImageSourceSchema,
  region: ScreenshotBoundingBoxSchema,
}).strict();

const OptimizeLosslessInputSchema = ScreenshotBaseInputSchema.extend({
  childCapabilityId: z.literal("optimize-lossless"),
  source: ScreenshotStoredImageSourceSchema,
  region: z.null().optional().default(null),
}).strict();

const PrepareAiInputInputSchema = ScreenshotBaseInputSchema.extend({
  childCapabilityId: z.literal("prepare-ai-input"),
  source: ScreenshotStoredImageSourceSchema,
  region: ScreenshotBoundingBoxSchema.nullable().optional().default(null),
}).strict();

const ScreenshotAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  CaptureBrowserViewportInputSchema,
  CaptureDesktopScreenInputSchema,
  CaptureRegionInputSchema,
  OptimizeLosslessInputSchema,
  PrepareAiInputInputSchema,
]);

const ScreenshotExecutionOutputSchema = z.object({
  artifactRef: ScreenshotArtifactRefSchema,
  artifactLifecycleManifestRef: z.string().min(1),
  evidenceId: z.string().min(1),
  pageUrl: nullableString,
  pageTitle: nullableString,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
  originalWidth: positiveFiniteNumber,
  originalHeight: positiveFiniteNumber,
  imageKind: ScreenshotImageKindSchema,
  coordinateSpace: ScreenshotCoordinateSpaceSchema,
  scaleMapping: ScreenshotScaleMappingSchema.nullable().optional().default(null),
  sourceScreenshotEvidenceId: nullableString,
  screenId: nullableString,
  sourceHash: z.string().min(1),
  outputHash: z.string().min(1),
  artifactHash: z.string().min(1),
  byteSize: nonNegativeInt,
  retentionClass: ScreenshotRetentionClassSchema,
  expiresAt: nullableDateTimeString,
  deleteAfter: nullableDateTimeString,
  promotionStatus: ScreenshotPromotionStatusSchema,
  cleanupEligible: z.boolean(),
  regionLabel: z.string().min(1),
  regionType: z.string().min(1),
  contentLines: z.array(z.string().min(1)).default([]),
}).strict();

const ScreenshotDecisionsSchema = z.object({
  privacyDecision: ScreenshotDecisionSchema,
  sourceDecision: ScreenshotDecisionSchema,
  browserSessionDecision: ScreenshotDecisionSchema,
  pageStateDecision: ScreenshotDecisionSchema,
  captureDecision: ScreenshotDecisionSchema,
  imageProcessingDecision: ScreenshotDecisionSchema,
  timeoutDecision: ScreenshotDecisionSchema,
  abortDecision: ScreenshotDecisionSchema,
  regionDecision: ScreenshotDecisionSchema,
  scaleMappingDecision: ScreenshotDecisionSchema,
  artifactDecision: ScreenshotDecisionSchema,
  outputBoundaryDecision: ScreenshotDecisionSchema,
}).strict();

const ScreenshotRuntimeProofIdentitySchema = z.object({
  proofId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  ...ScreenshotProofGovernanceShape,
  abilityGroupId: z.literal(SCREENSHOT_ABILITY_GROUP_ID),
  childCapabilityId: ScreenshotChildCapabilityIdSchema,
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  inputRef: z.string().min(1),
  outputRef: nullableString,
  sourceProofRef: nullableString,
  pageStateProofRef: nullableString,
  browserSessionRef: nullableString,
  screenshotEvidenceId: nullableString,
  artifactRef: ScreenshotArtifactRefSchema.nullable().optional().default(null),
  sourceArtifactRef: ScreenshotArtifactRefSchema.nullable().optional().default(null),
  artifactLifecycleManifestRef: z.string().min(1).nullable().optional().default(null),
  retentionClass: ScreenshotRetentionClassSchema.nullable().optional().default(null),
  promotionStatus: ScreenshotPromotionStatusSchema.nullable().optional().default(null),
  expiresAt: nullableDateTimeString,
  deleteAfter: nullableDateTimeString,
  cleanupEligible: nullableBoolean,
}).strict();

const ScreenshotRuntimeProofMetricsSchema = z.object({
  sourceHash: nullableString,
  outputHash: nullableString,
  artifactHash: nullableString,
  byteSize: nonNegativeInt.nullable().optional().default(null),
  sourceWidth: positiveFiniteNumber.nullable().optional().default(null),
  sourceHeight: positiveFiniteNumber.nullable().optional().default(null),
  outputWidth: positiveFiniteNumber.nullable().optional().default(null),
  outputHeight: positiveFiniteNumber.nullable().optional().default(null),
  coordinateSpace: ScreenshotCoordinateSpaceSchema.nullable().optional().default(null),
  sourceCoordinateSpace: ScreenshotCoordinateSpaceSchema.exclude(["ai_input_pixels"]).nullable().optional().default(null),
  scaleMapping: ScreenshotScaleMappingSchema.nullable().optional().default(null),
  region: ScreenshotBoundingBoxSchema.nullable().optional().default(null),
}).strict();

const ScreenshotRuntimeProofTimingSchema = z.object({
  idempotencyKey: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: ScreenshotStatusSchema,
  failureReason: ScreenshotFailureSchema.nullable().optional().default(null),
  reviewRequiredReason: nullableString,
  dataQualityFlags: z.array(ScreenshotDataQualityFlagSchema).default([]),
  clock: z.object({
    portKind: z.literal("system-monotonic-screenshot-clock"),
    startedMonotonicMs: z.number().finite(),
    endedMonotonicMs: z.number().finite(),
  }).strict(),
}).strict();

const ScreenshotRuntimeProofBaseSchema = ScreenshotRuntimeProofIdentitySchema
  .merge(ScreenshotRuntimeProofMetricsSchema)
  .merge(ScreenshotDecisionsSchema)
  .merge(ScreenshotRuntimeProofTimingSchema)
  .strict();

export const SCREENSHOT_SCHEMA_VALIDATION_MARKERS = [
  "success proof requires outputRef",
  "non-success proof must not expose outputRef",
  "non-success result must not expose output",
  "diagnosticPayloadRef",
  "prepare-ai-input proof requires scaleMapping",
  "capture-region success proof requires sourceScreenshotEvidenceId in scaleMapping",
  "success proof requires lifecycle manifest",
  "SCREENSHOT_PROOF_CHAIN_FIELD_NAMES",
  "SCREENSHOT_RESULT_CHAIN_FIELD_NAMES",
] as const;

function validateScreenshotRuntimeProof(value: z.infer<typeof ScreenshotRuntimeProofBaseSchema>, context: z.RefinementCtx) {
  validateScreenshotRuntimeProofCore(value, context);
  validateScreenshotRuntimeProofPrepareAiInput(value, context);
}

const ScreenshotRuntimeProofSchema = ScreenshotRuntimeProofBaseSchema.superRefine(validateScreenshotRuntimeProof);

const ScreenshotResultSchema = z.object({
  abilityGroupId: z.literal(SCREENSHOT_ABILITY_GROUP_ID),
  childCapabilityId: ScreenshotChildCapabilityIdSchema,
  ...ScreenshotResultGovernanceShape,
  status: ScreenshotStatusSchema,
  message: z.string().min(1),
  output: ScreenshotExecutionOutputSchema.nullable().optional().default(null),
  failureReason: ScreenshotFailureSchema.nullable().optional().default(null),
  reviewRequiredReason: nullableString,
  dataQualityFlags: z.array(ScreenshotDataQualityFlagSchema).default([]),
  runtimeProof: ScreenshotRuntimeProofSchema,
}).strict().superRefine(validateScreenshotResult);


export { ScreenshotChildCapabilityIdSchema, ScreenshotStatusSchema, ScreenshotSourceKindSchema, ScreenshotCoordinateSpaceSchema, ScreenshotImageKindSchema, ScreenshotEvidencePolicySchema, ScreenshotRetentionClassSchema, ScreenshotPromotionStatusSchema, ScreenshotFailureCodeSchema, ScreenshotDataQualityFlagSchema, ScreenshotDecisionStatusSchema, ScreenshotPageStateStatusSchema, ScreenshotFailureSchema, ScreenshotBoundingBoxSchema, ScreenshotCaptureBoundsSchema, ScreenshotScaleMappingSchema, ScreenshotArtifactRefSchema, ScreenshotStoredArtifactSchema, ScreenshotSourceProofSchema, ScreenshotCapturePolicySchema, ScreenshotPrivacyPolicySchema, ScreenshotPageStateProofSchema, ScreenshotDecisionSchema, ScreenshotBrowserSessionSnapshotSchema, ScreenshotBrowserCaptureSchema, ScreenshotDesktopCaptureSchema, ScreenshotStoredImageSourceSchema, ScreenshotBrowserViewportSourceSchema, ScreenshotDesktopScreenSourceSchema, ScreenshotArtifactBudgetPolicySchema, ScreenshotArtifactBudgetSnapshotSchema, ScreenshotArtifactCleanupGateSchema, ScreenshotArtifactLifecycleManifestSchema, CaptureBrowserViewportInputSchema, CaptureDesktopScreenInputSchema, CaptureRegionInputSchema, OptimizeLosslessInputSchema, PrepareAiInputInputSchema, ScreenshotAbilityInputSchema, ScreenshotExecutionOutputSchema, ScreenshotRuntimeProofSchema, ScreenshotResultSchema };
