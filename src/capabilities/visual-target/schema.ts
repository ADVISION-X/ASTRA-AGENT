import { z } from "zod";

import { VISUAL_TARGET_DATA_QUALITY_FLAGS } from "./shared/visual-target-candidate.js";
import { VISUAL_TARGET_FAILURE_REASONS } from "./shared/visual-target-failure.js";
import { VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY, VISUAL_TARGET_CLOCK_KIND } from "./shared/visual-target-proof.js";
import {
  VISUAL_TARGET_AI_DECISIONS,
  VISUAL_TARGET_AMBIGUITY_DECISIONS,
  VISUAL_TARGET_ABILITY_GROUP_ID,
  VISUAL_TARGET_CANDIDATE_KINDS,
  VISUAL_TARGET_CANDIDATE_SOURCE_DECISIONS,
  VISUAL_TARGET_CHILD_CAPABILITY_IDS,
  VISUAL_TARGET_COORDINATE_DECISIONS,
  VISUAL_TARGET_COORDINATE_SPACES,
  VISUAL_TARGET_NATURES,
  VISUAL_TARGET_PAGE_STATE_DECISIONS,
  VISUAL_TARGET_SCREENSHOT_DECISIONS,
  VISUAL_TARGET_SELECTION_DECISIONS,
  VISUAL_TARGET_STATUSES,
  VISUAL_TARGET_TARGET_TYPE_DECISIONS,
  VISUAL_TARGET_TYPES,
} from "./shared/visual-target-types.js";

const nullableString = z.string().min(1).nullable().optional().default(null);
const finiteNumber = z.number().finite();
const confidenceNumber = z.number().min(0).max(1);
const nonNegativeInt = z.number().int().nonnegative();

export const VisualTargetChildCapabilityIdSchema = z.enum(VISUAL_TARGET_CHILD_CAPABILITY_IDS);
export const VisualTargetStatusSchema = z.enum(VISUAL_TARGET_STATUSES);
export const VisualTargetTypeSchema = z.enum(VISUAL_TARGET_TYPES);
export const VisualTargetNatureSchema = z.enum(VISUAL_TARGET_NATURES);
export const VisualTargetCandidateKindSchema = z.enum(VISUAL_TARGET_CANDIDATE_KINDS);
export const VisualTargetCoordinateSpaceSchema = z.enum(VISUAL_TARGET_COORDINATE_SPACES);
export const VisualTargetFailureReasonSchema = z.enum(VISUAL_TARGET_FAILURE_REASONS);
export const VisualTargetDataQualityFlagSchema = z.enum(VISUAL_TARGET_DATA_QUALITY_FLAGS);

export const VisualBoundingBoxSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: z.number().positive(),
  height: z.number().positive(),
}).strict();

export const VisualClickPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
}).strict();

export const VisualTargetScaleMappingSchema = z.object({
  sourceWidth: z.number().positive(),
  sourceHeight: z.number().positive(),
  targetWidth: z.number().positive(),
  targetHeight: z.number().positive(),
  cropOffsetX: finiteNumber,
  cropOffsetY: finiteNumber,
  scaleX: z.number().positive(),
  scaleY: z.number().positive(),
  sourceCoordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["contact_sheet", "ai_input"]),
  targetCoordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["contact_sheet"]),
}).strict();

export const VisualTargetScreenshotSourceProofSchema = z.object({
  screenshotEvidenceId: z.string().min(1),
  artifactRef: z.string().min(1),
  screenshotProofRef: z.string().min(1),
  imageWidth: z.number().positive(),
  imageHeight: z.number().positive(),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["contact_sheet"]),
  capturedAt: z.string().datetime(),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
}).strict();

export const VisualTargetAiSourceProofSchema = z.object({
  aiResultRef: z.string().min(1),
  aiProofRef: z.string().min(1),
  promptContractId: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  capturedAt: z.string().datetime(),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  confidence: confidenceNumber,
  modelRole: z.string().min(1),
}).strict();

export const VisualTargetPageStateProofSchema = z.object({
  pageStateProofRef: z.string().min(1),
  pageStateType: z.string().min(1),
  pageStateFingerprint: z.string().min(1),
  decision: z.enum(["allow", "review_required", "block"]),
  currentUrl: z.string().min(1),
  currentTitle: nullableString,
  observedAt: z.string().datetime(),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
}).strict();

export const VisualTargetOperatorApprovalProofSchema = z.object({
  operatorApprovalRef: z.string().min(1),
  approvedAt: z.string().datetime(),
  operatorId: z.string().min(1),
}).strict();

export const VisualTargetSourceProofSchema = z.object({
  sourceProofRef: z.string().min(1),
  screenshot: VisualTargetScreenshotSourceProofSchema,
  ai: VisualTargetAiSourceProofSchema.nullable().default(null),
  pageState: VisualTargetPageStateProofSchema,
  operatorApproval: VisualTargetOperatorApprovalProofSchema.nullable().default(null),
}).strict();

export const VisualTargetCandidateSchema = z.object({
  candidateRef: z.string().min(1),
  candidateKind: VisualTargetCandidateKindSchema,
  targetType: VisualTargetTypeSchema,
  boundingBox: VisualBoundingBoxSchema,
  clickPoint: VisualClickPointSchema.nullable().default(null),
  confidence: confidenceNumber,
  coordinateSpace: VisualTargetCoordinateSpaceSchema,
  sourceProofRef: z.string().min(1),
  capturedAt: z.string().datetime(),
  sourceFrameRef: nullableString,
  detectionMethod: z.string().min(1),
  visibleText: nullableString,
  uncertainty: z.array(z.string().min(1)).default([]),
  blockedReason: nullableString,
  isVisible: z.boolean(),
  scaleMapping: VisualTargetScaleMappingSchema.nullable().default(null),
  dataQualityFlags: z.array(VisualTargetDataQualityFlagSchema).default([]),
}).strict();

export const VisualTargetAbilityInputSchema = z.object({
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID).default(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  requestedBy: z.string().min(1),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  inputRef: z.string().min(1),
  targetType: VisualTargetTypeSchema,
  targetNature: VisualTargetNatureSchema,
  sourceProof: VisualTargetSourceProofSchema,
  candidates: z.array(VisualTargetCandidateSchema),
}).strict();

const VisualTargetBaseResultSchema = z.object({
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  targetNature: VisualTargetNatureSchema,
  status: VisualTargetStatusSchema,
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  targetType: VisualTargetTypeSchema,
  targetId: nullableString,
  sourceScreenshotEvidenceId: z.string().min(1),
  sourceScreenshotProofRef: z.string().min(1),
  sourceAiResultRef: nullableString,
  sourceAiProofRef: nullableString,
  sourcePageStateProofRef: z.string().min(1),
  sourceCandidateRef: nullableString,
  coordinateSpace: VisualTargetCoordinateSpaceSchema.nullable().default(null),
  boundingBox: VisualBoundingBoxSchema.nullable().default(null),
  clickPoint: VisualClickPointSchema.nullable().default(null),
  executableCoordinate: z.null(),
  confidence: confidenceNumber.nullable().default(null),
  requiresGeometryGuard: z.boolean(),
  geometryGuardHandoffRequired: z.boolean(),
  actionable: z.boolean(),
  detectionMethod: nullableString,
  visibleText: nullableString,
  uncertainty: z.array(z.string().min(1)),
  blockedReason: nullableString,
  failureReason: VisualTargetFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: z.string().min(1),
  debugLogRef: z.string().min(1),
  dataQualityFlags: z.array(VisualTargetDataQualityFlagSchema),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  durationMs: nonNegativeInt,
}).strict();

export const VisualTargetActionSuccessResultSchema = VisualTargetBaseResultSchema.extend({
  status: z.literal("success"),
  targetNature: z.literal("action"),
  targetId: z.string().min(1),
  sourceCandidateRef: z.string().min(1),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["contact_sheet", "ai_input"]),
  boundingBox: VisualBoundingBoxSchema,
  clickPoint: VisualClickPointSchema,
  confidence: confidenceNumber,
  requiresGeometryGuard: z.literal(true),
  geometryGuardHandoffRequired: z.literal(true),
  actionable: z.literal(true),
  failureReason: z.null(),
  reviewRequiredReason: z.null(),
}).strict();

export const VisualTargetRegionSuccessResultSchema = VisualTargetBaseResultSchema.extend({
  status: z.literal("success"),
  targetNature: z.literal("region"),
  targetId: z.string().min(1),
  sourceCandidateRef: z.string().min(1),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["contact_sheet"]),
  boundingBox: VisualBoundingBoxSchema,
  clickPoint: z.null(),
  confidence: confidenceNumber,
  requiresGeometryGuard: z.literal(true),
  geometryGuardHandoffRequired: z.literal(true),
  actionable: z.literal(false),
  failureReason: z.null(),
  reviewRequiredReason: z.null(),
}).strict();

export const VisualTargetMetricSuccessResultSchema = VisualTargetBaseResultSchema.extend({
  status: z.literal("success"),
  targetNature: z.literal("metric"),
  targetId: z.string().min(1),
  sourceCandidateRef: z.string().min(1),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["contact_sheet"]),
  boundingBox: VisualBoundingBoxSchema,
  clickPoint: z.null(),
  confidence: confidenceNumber,
  requiresGeometryGuard: z.literal(true),
  geometryGuardHandoffRequired: z.literal(true),
  actionable: z.literal(false),
  failureReason: z.null(),
  reviewRequiredReason: z.null(),
}).strict();

export const VisualTargetNonSuccessResultSchema = VisualTargetBaseResultSchema.extend({
  status: VisualTargetStatusSchema.exclude(["success"]),
  targetId: z.null(),
  sourceCandidateRef: nullableString,
  coordinateSpace: z.null(),
  boundingBox: z.null(),
  clickPoint: z.null(),
  confidence: z.null(),
  actionable: z.literal(false),
}).strict();

export const VisualTargetResultSchema = z.discriminatedUnion("status", [
  VisualTargetActionSuccessResultSchema,
  VisualTargetRegionSuccessResultSchema,
  VisualTargetMetricSuccessResultSchema,
  VisualTargetNonSuccessResultSchema,
]);

export const VisualTargetRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  inputRef: z.string().min(1),
  outputRef: z.string().min(1),
  screenshotEvidenceId: z.string().min(1),
  screenshotProofRef: z.string().min(1),
  aiResultRef: nullableString,
  aiProofRef: nullableString,
  pageStateProofRef: z.string().min(1),
  candidateRef: nullableString,
  selectedTargetType: VisualTargetTypeSchema,
  candidateCount: nonNegativeInt,
  rejectedCandidateRefs: z.array(z.string().min(1)),
  selectedCandidateRef: nullableString,
  coordinateSpace: VisualTargetCoordinateSpaceSchema.nullable().default(null),
  boundingBox: VisualBoundingBoxSchema.nullable().default(null),
  clickPoint: VisualClickPointSchema.nullable().default(null),
  geometryGuardHandoffRequired: z.boolean(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: VisualTargetStatusSchema,
  failureReason: VisualTargetFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  screenshotDecision: z.enum(VISUAL_TARGET_SCREENSHOT_DECISIONS),
  aiDecision: z.enum(VISUAL_TARGET_AI_DECISIONS),
  pageStateDecision: z.enum(VISUAL_TARGET_PAGE_STATE_DECISIONS),
  candidateSourceDecision: z.enum(VISUAL_TARGET_CANDIDATE_SOURCE_DECISIONS),
  coordinateSpaceDecision: z.enum(VISUAL_TARGET_COORDINATE_DECISIONS),
  targetTypeDecision: z.enum(VISUAL_TARGET_TARGET_TYPE_DECISIONS),
  selectionDecision: z.enum(VISUAL_TARGET_SELECTION_DECISIONS),
  ambiguityDecision: z.enum(VISUAL_TARGET_AMBIGUITY_DECISIONS),
  dataQualityFlags: z.array(VisualTargetDataQualityFlagSchema),
  geometryGuardHandoffPolicy: z.literal(VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY),
  clock: z.object({
    portKind: z.literal(VISUAL_TARGET_CLOCK_KIND),
    startedMonotonicMs: finiteNumber,
    endedMonotonicMs: finiteNumber,
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success" && !value.geometryGuardHandoffRequired) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires geometryGuardHandoffRequired=true", path: ["geometryGuardHandoffRequired"] });
  }
  if (value.status !== "success" && value.selectedCandidateRef && value.clickPoint) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must not expose actionable clickPoint", path: ["clickPoint"] });
  }
});

export const VisualTargetAbilityResultSchema = VisualTargetResultSchema.and(z.object({
  runtimeProof: VisualTargetRuntimeProofSchema,
}));