import { z } from "zod";

import { VISUAL_TARGET_DATA_QUALITY_FLAGS } from "./shared/visual-target-candidate.js";
import { VISUAL_TARGET_FAILURE_REASONS } from "./shared/visual-target-failure.js";
import { VISUAL_TARGET_EXECUTION_BOUNDARY, VISUAL_TARGET_GEOMETRY_HANDOFF_KIND } from "./shared/visual-target-geometry-handoff.js";
import { VISUAL_TARGET_CHAIN_FIELD_NAMES, VisualTargetAmbiguityPolicySchema, VisualTargetChainInputShape, VisualTargetChainResultShape, VisualTargetConfidencePolicySchema, VisualTargetCoordinatePolicySchema, VisualTargetDataQualityPolicySchema, VisualTargetSelectionPolicySchema } from "./shared/visual-target-governance.js";
import { VISUAL_TARGET_CLOCK_KIND, VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY, VISUAL_TARGET_NON_EXECUTABLE_COORDINATE_POLICY } from "./shared/visual-target-proof.js";
import {
  VISUAL_TARGET_AI_DECISIONS,
  VISUAL_TARGET_AMBIGUITY_DECISIONS,
  VISUAL_TARGET_ABILITY_GROUP_ID,
  VISUAL_TARGET_CANDIDATE_KINDS,
  VISUAL_TARGET_CANDIDATE_SOURCE_DECISIONS,
  VISUAL_TARGET_CRITICAL_DATA_QUALITY_DECISIONS,
  VISUAL_TARGET_CHILD_CAPABILITY_IDS,
  VISUAL_TARGET_COORDINATE_DECISIONS,
  VISUAL_TARGET_COORDINATE_SPACES,
  VISUAL_TARGET_GEOMETRY_HANDOFF_DECISIONS,
  VISUAL_TARGET_NATURES,
  VISUAL_TARGET_OUTPUT_BOUNDARY_DECISIONS,
  VISUAL_TARGET_PAGE_STATE_DECISIONS,
  VISUAL_TARGET_PAYLOAD_BUDGET_DECISIONS,
  VISUAL_TARGET_SCREENSHOT_DECISIONS,
  VISUAL_TARGET_SELECTION_DECISIONS,
  VISUAL_TARGET_SOURCE_BINDING_DECISIONS,
  VISUAL_TARGET_STATUSES,
  VISUAL_TARGET_TARGET_TYPE_DECISIONS,
  VISUAL_TARGET_TYPES,
} from "./shared/visual-target-types.js";

const nullableString = z.string().min(1).nullable().optional().default(null);
const finiteNumber = z.number().finite();
const confidenceNumber = z.number().min(0).max(1);
const nonNegativeInt = z.number().int().nonnegative();
const limitedString = (max: number) => z.string().min(1).max(max);

const VisualTargetChildCapabilityIdSchema = z.enum(VISUAL_TARGET_CHILD_CAPABILITY_IDS);
const VisualTargetStatusSchema = z.enum(VISUAL_TARGET_STATUSES);
const VisualTargetTypeSchema = z.enum(VISUAL_TARGET_TYPES);
const VisualTargetNatureSchema = z.enum(VISUAL_TARGET_NATURES);
const VisualTargetCandidateKindSchema = z.enum(VISUAL_TARGET_CANDIDATE_KINDS);
const VisualTargetCoordinateSpaceSchema = z.enum(VISUAL_TARGET_COORDINATE_SPACES);
const VisualTargetFailureReasonSchema = z.enum(VISUAL_TARGET_FAILURE_REASONS);
const VisualTargetDataQualityFlagSchema = z.enum(VISUAL_TARGET_DATA_QUALITY_FLAGS);
const VisualTargetPayloadBudgetDecisionSchema = z.enum(VISUAL_TARGET_PAYLOAD_BUDGET_DECISIONS);
const VisualTargetOutputBoundaryDecisionSchema = z.enum(VISUAL_TARGET_OUTPUT_BOUNDARY_DECISIONS);
const VisualTargetSourceBindingDecisionSchema = z.enum(VISUAL_TARGET_SOURCE_BINDING_DECISIONS);
const VisualTargetCriticalDataQualityDecisionSchema = z.enum(VISUAL_TARGET_CRITICAL_DATA_QUALITY_DECISIONS);
const VisualTargetGeometryHandoffDecisionSchema = z.enum(VISUAL_TARGET_GEOMETRY_HANDOFF_DECISIONS);

const VisualBoundingBoxSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: z.number().positive(),
  height: z.number().positive(),
}).strict();

const VisualClickPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
}).strict();

const VisualTargetScaleMappingSchema = z.object({
  sourceScreenshotEvidenceId: limitedString(160),
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

const VisualTargetScreenshotSourceProofSchema = z.object({
  screenshotEvidenceId: limitedString(160),
  artifactRef: limitedString(200),
  screenshotProofRef: limitedString(200),
  artifactHash: limitedString(128),
  imageHash: limitedString(128),
  imageWidth: z.number().positive(),
  imageHeight: z.number().positive(),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["contact_sheet"]),
  coordinateAuthority: z.enum(["evidence_original", "ai_input_non_executable", "region_crop", "optimized_equivalent"]),
  sourceScreenshotEvidenceId: nullableString,
  scaleMapping: VisualTargetScaleMappingSchema.nullable().default(null),
  capturedAt: z.string().datetime(),
  sessionId: limitedString(160),
  roundId: nullableString,
  videoVisitId: nullableString,
}).strict();

const VisualTargetAiSourceProofSchema = z.object({
  aiResultRef: limitedString(200),
  aiProofRef: limitedString(200),
  promptContractId: limitedString(160),
  outputSchemaRef: limitedString(160),
  aiInputArtifactRef: limitedString(200),
  aiInputHash: limitedString(128),
  outputPayloadHash: limitedString(128),
  sourceImageHash: limitedString(128),
  sourceScreenshotEvidenceId: limitedString(160),
  sourceScreenshotProofRef: limitedString(200),
  capturedAt: z.string().datetime(),
  sessionId: limitedString(160),
  roundId: nullableString,
  videoVisitId: nullableString,
  confidence: confidenceNumber,
  modelRole: limitedString(120),
}).strict();

const VisualTargetPageStateProofSchema = z.object({
  pageStateProofRef: limitedString(200),
  pageStateType: limitedString(120),
  pageStateFingerprint: limitedString(200),
  pageStateHash: limitedString(128),
  decision: z.enum(["allow", "review_required", "block"]),
  currentUrl: limitedString(500),
  currentTitle: nullableString,
  observedAt: z.string().datetime(),
  sessionId: limitedString(160),
  roundId: nullableString,
  videoVisitId: nullableString,
}).strict();

const VisualTargetOperatorApprovalProofSchema = z.object({
  operatorApprovalRef: limitedString(200),
  approvedAt: z.string().datetime(),
  operatorId: limitedString(120),
}).strict();

const VisualTargetSourceProofSchema = z.object({
  sourceProofRef: limitedString(200),
  screenshot: VisualTargetScreenshotSourceProofSchema,
  ai: VisualTargetAiSourceProofSchema.nullable().default(null),
  pageState: VisualTargetPageStateProofSchema,
  operatorApproval: VisualTargetOperatorApprovalProofSchema.nullable().default(null),
}).strict();

const VisualTargetCandidateSchema = z.object({
  candidateRef: limitedString(160),
  candidateKind: VisualTargetCandidateKindSchema,
  targetType: VisualTargetTypeSchema,
  boundingBox: VisualBoundingBoxSchema,
  clickPoint: VisualClickPointSchema.nullable().default(null),
  confidence: confidenceNumber,
  coordinateSpace: VisualTargetCoordinateSpaceSchema,
  sourceProofRef: limitedString(200),
  capturedAt: z.string().datetime(),
  sourceFrameRef: z.string().min(1).max(160).nullable().optional().default(null),
  detectionMethod: limitedString(120),
  visibleText: z.string().min(1).max(500).nullable().optional().default(null),
  uncertainty: z.array(limitedString(120)).max(20).default([]),
  blockedReason: z.string().min(1).max(500).nullable().optional().default(null),
  isVisible: z.boolean(),
  scaleMapping: VisualTargetScaleMappingSchema.nullable().default(null),
  dataQualityFlags: z.array(VisualTargetDataQualityFlagSchema).max(30).default([]),
}).strict();

const VisualTargetAbilityInputSchema = z.object({
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID).default(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  ...VisualTargetChainInputShape,
  sessionId: limitedString(160),
  roundId: nullableString,
  videoVisitId: nullableString,
  requestedBy: limitedString(120),
  sourceAbilityGroupId: limitedString(120),
  sourceChildCapabilityId: nullableString,
  inputRef: limitedString(200),
  targetType: VisualTargetTypeSchema,
  targetNature: VisualTargetNatureSchema,
  sourceProof: VisualTargetSourceProofSchema,
  candidates: z.array(VisualTargetCandidateSchema).max(50),
  confidencePolicy: VisualTargetConfidencePolicySchema,
  selectionPolicy: VisualTargetSelectionPolicySchema,
  ambiguityPolicy: VisualTargetAmbiguityPolicySchema,
  coordinatePolicy: VisualTargetCoordinatePolicySchema,
  dataQualityPolicy: VisualTargetDataQualityPolicySchema,
}).strict();

const VisualTargetGeometryGuardHandoffSchema = z.object({
  handoffRef: limitedString(200),
  handoffKind: z.literal(VISUAL_TARGET_GEOMETRY_HANDOFF_KIND),
  executionBoundary: z.literal(VISUAL_TARGET_EXECUTION_BOUNDARY),
  sourceScreenshotEvidenceId: limitedString(160),
  sourceScreenshotProofRef: limitedString(200),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["ai_input", "contact_sheet"]),
  originalCandidateCoordinateSpace: VisualTargetCoordinateSpaceSchema,
  boundingBox: VisualBoundingBoxSchema,
  clickPoint: VisualClickPointSchema,
  scaleMapping: VisualTargetScaleMappingSchema.nullable().default(null),
}).strict();

const VisualTargetActionOutputSchema = z.object({
  targetNature: z.literal("action"),
  targetId: limitedString(200),
  sourceCandidateRef: limitedString(160),
  sourceScreenshotEvidenceId: limitedString(160),
  sourceScreenshotProofRef: limitedString(200),
  sourceAiResultRef: nullableString,
  sourceAiProofRef: nullableString,
  sourcePageStateProofRef: limitedString(200),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["ai_input", "contact_sheet"]),
  originalCandidateCoordinateSpace: VisualTargetCoordinateSpaceSchema,
  boundingBox: VisualBoundingBoxSchema,
  candidateClickPoint: VisualClickPointSchema,
  confidence: confidenceNumber,
  executable: z.literal(false),
  actionIntentCandidate: z.literal(true),
  notExecutableUntilGeometryGuard: z.literal(true),
  geometryGuardHandoffRequired: z.literal(true),
  geometryGuardHandoffRef: limitedString(200),
  geometryGuardHandoff: VisualTargetGeometryGuardHandoffSchema,
  visibleText: nullableString,
  parsedValue: z.null(),
  metricValue: z.null(),
}).strict();

const VisualTargetRegionOutputSchema = z.object({
  targetNature: z.literal("region"),
  targetId: limitedString(200),
  sourceCandidateRef: limitedString(160),
  sourceScreenshotEvidenceId: limitedString(160),
  sourceScreenshotProofRef: limitedString(200),
  sourceAiResultRef: nullableString,
  sourceAiProofRef: nullableString,
  sourcePageStateProofRef: limitedString(200),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["ai_input", "contact_sheet"]),
  originalCandidateCoordinateSpace: VisualTargetCoordinateSpaceSchema,
  boundingBox: VisualBoundingBoxSchema,
  candidateClickPoint: z.null(),
  confidence: confidenceNumber,
  executable: z.literal(false),
  actionIntentCandidate: z.literal(false),
  notExecutableUntilGeometryGuard: z.boolean(),
  geometryGuardHandoffRequired: z.boolean(),
  geometryGuardHandoffRef: nullableString,
  geometryGuardHandoff: VisualTargetGeometryGuardHandoffSchema.nullable().default(null),
  visibleText: nullableString,
  parsedValue: z.null(),
  metricValue: z.null(),
}).strict();

const VisualTargetMetricOutputSchema = z.object({
  targetNature: z.literal("metric"),
  targetId: limitedString(200),
  sourceCandidateRef: limitedString(160),
  sourceScreenshotEvidenceId: limitedString(160),
  sourceScreenshotProofRef: limitedString(200),
  sourceAiResultRef: nullableString,
  sourceAiProofRef: nullableString,
  sourcePageStateProofRef: limitedString(200),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["ai_input", "contact_sheet"]),
  originalCandidateCoordinateSpace: VisualTargetCoordinateSpaceSchema,
  boundingBox: VisualBoundingBoxSchema,
  candidateClickPoint: z.null(),
  confidence: confidenceNumber,
  executable: z.literal(false),
  actionIntentCandidate: z.literal(false),
  notExecutableUntilGeometryGuard: z.literal(false),
  geometryGuardHandoffRequired: z.literal(false),
  geometryGuardHandoffRef: z.null(),
  geometryGuardHandoff: z.null(),
  visibleText: nullableString,
  parsedValue: finiteNumber.nullable().default(null),
  metricValue: finiteNumber.nullable().default(null),
}).strict();

const VisualTargetOutputSchema = z.discriminatedUnion("targetNature", [
  VisualTargetActionOutputSchema,
  VisualTargetRegionOutputSchema,
  VisualTargetMetricOutputSchema,
]);

const VisualTargetBaseResultSchema = z.object({
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema.nullable().default(null),
  targetNature: VisualTargetNatureSchema.nullable().default(null),
  status: VisualTargetStatusSchema,
  ...VisualTargetChainResultShape,
  sessionId: z.string().min(1).max(160).nullable().default(null),
  roundId: nullableString,
  videoVisitId: nullableString,
  targetType: VisualTargetTypeSchema.nullable().default(null),
  output: VisualTargetOutputSchema.nullable().default(null),
  failureReason: VisualTargetFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: limitedString(500),
  debugLogRef: limitedString(200),
  diagnosticPayloadRef: nullableString,
  dataQualityFlags: z.array(VisualTargetDataQualityFlagSchema).max(30),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  durationMs: nonNegativeInt,
}).strict();

const VisualTargetActionSuccessResultSchema = VisualTargetBaseResultSchema.extend({
  status: z.literal("success"),
  targetNature: z.literal("action"),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  sessionId: limitedString(160),
  targetType: VisualTargetTypeSchema,
  output: VisualTargetActionOutputSchema,
  failureReason: z.null(),
  reviewRequiredReason: z.null(),
  diagnosticPayloadRef: z.null(),
}).strict();

const VisualTargetRegionSuccessResultSchema = VisualTargetBaseResultSchema.extend({
  status: z.literal("success"),
  targetNature: z.literal("region"),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  sessionId: limitedString(160),
  targetType: VisualTargetTypeSchema,
  output: VisualTargetRegionOutputSchema,
  failureReason: z.null(),
  reviewRequiredReason: z.null(),
  diagnosticPayloadRef: z.null(),
}).strict();

const VisualTargetMetricSuccessResultSchema = VisualTargetBaseResultSchema.extend({
  status: z.literal("success"),
  targetNature: z.literal("metric"),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  sessionId: limitedString(160),
  targetType: VisualTargetTypeSchema,
  output: VisualTargetMetricOutputSchema,
  failureReason: z.null(),
  reviewRequiredReason: z.null(),
  diagnosticPayloadRef: z.null(),
}).strict();

const VisualTargetNonSuccessResultSchema = VisualTargetBaseResultSchema.extend({
  status: VisualTargetStatusSchema.exclude(["success"]),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  targetType: VisualTargetTypeSchema,
  targetNature: VisualTargetNatureSchema,
  sessionId: limitedString(160),
  output: z.null(),
  diagnosticPayloadRef: limitedString(200),
}).strict();

const VisualTargetInvalidInputFailureResultSchema = VisualTargetBaseResultSchema.extend({
  status: z.literal("failed"),
  childCapabilityId: VisualTargetChildCapabilityIdSchema.nullable().default(null),
  targetType: VisualTargetTypeSchema.nullable().default(null),
  targetNature: VisualTargetNatureSchema.nullable().default(null),
  sessionId: z.string().min(1).max(160).nullable().default(null),
  output: z.null(),
  failureReason: z.literal("input_schema_invalid"),
  diagnosticPayloadRef: limitedString(200),
}).strict();

const VisualTargetResultSchema = z.union([
  VisualTargetActionSuccessResultSchema,
  VisualTargetRegionSuccessResultSchema,
  VisualTargetMetricSuccessResultSchema,
  VisualTargetNonSuccessResultSchema,
  VisualTargetInvalidInputFailureResultSchema,
]);

const VisualTargetCandidateScoreTraceSchema = z.object({
  candidateRef: limitedString(160),
  rawConfidence: confidenceNumber,
  freshnessPenalty: z.number().min(0),
  dataQualityPenalty: z.number().min(0),
  sourcePenalty: z.number().min(0),
  finalScore: finiteNumber,
  tieBreakKey: limitedString(200),
}).strict();

const addChainFieldRequirementIssues = (record: Record<string, unknown>, context: z.RefinementCtx, scope: "runtimeProof" | "result"): void => {
  for (const fieldName of VISUAL_TARGET_CHAIN_FIELD_NAMES) {
    if (record[fieldName] == null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} is required in ${scope}`, path: [fieldName] });
    }
  }
};

const VisualTargetRuntimeProofBaseSchema = z.object({
  proofId: limitedString(200),
  runId: limitedString(200),
  missionId: nullableString,
  stepId: nullableString,
  mapPackageId: nullableString,
  mapPackageVersion: nullableString,
  selectedMapId: nullableString,
  selectedMapVersion: nullableString,
  activationSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  sessionId: z.string().min(1).max(160).nullable().default(null),
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema.nullable().default(null),
  sourceAbilityGroupId: z.string().min(1).max(120).nullable().default(null),
  sourceChildCapabilityId: nullableString,
  inputRef: nullableString,
  outputRef: nullableString,
  diagnosticPayloadRef: nullableString,
  debugLogRef: limitedString(200),
  structuredRuntimeEventRef: limitedString(200),
  inputPayloadHash: limitedString(128),
  screenshotEvidenceId: nullableString,
  screenshotProofRef: nullableString,
  screenshotHash: nullableString,
  aiResultRef: nullableString,
  aiProofRef: nullableString,
  aiInputHash: nullableString,
  aiOutputPayloadHash: nullableString,
  pageStateProofRef: nullableString,
  pageStateHash: nullableString,
  selectedTargetType: VisualTargetTypeSchema.nullable().default(null),
  candidateCount: nonNegativeInt,
  candidateSetHash: limitedString(128),
  rejectedCandidateRefs: z.array(limitedString(160)).max(50),
  candidateScoreTrace: z.array(VisualTargetCandidateScoreTraceSchema).max(50),
  selectionTrace: z.array(limitedString(500)).max(20),
  ambiguityTrace: z.array(limitedString(500)).max(20),
  coordinateTransformTrace: z.array(limitedString(500)).max(50),
  selectedCandidateRef: nullableString,
  selectedCandidateHash: nullableString,
  coordinateSpace: VisualTargetCoordinateSpaceSchema.nullable().default(null),
  boundingBox: VisualBoundingBoxSchema.nullable().default(null),
  clickPoint: VisualClickPointSchema.nullable().default(null),
  geometryGuardHandoffRef: nullableString,
  notExecutableUntilGeometryGuard: z.boolean(),
  geometryGuardHandoffRequired: z.boolean(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: VisualTargetStatusSchema,
  failureReason: VisualTargetFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  payloadBudgetDecision: VisualTargetPayloadBudgetDecisionSchema,
  screenshotDecision: z.enum(VISUAL_TARGET_SCREENSHOT_DECISIONS),
  aiDecision: z.enum(VISUAL_TARGET_AI_DECISIONS),
  pageStateDecision: z.enum(VISUAL_TARGET_PAGE_STATE_DECISIONS),
  candidateSourceDecision: z.enum(VISUAL_TARGET_CANDIDATE_SOURCE_DECISIONS),
  candidateSourceBindingDecision: VisualTargetSourceBindingDecisionSchema,
  coordinateSpaceDecision: z.enum(VISUAL_TARGET_COORDINATE_DECISIONS),
  targetTypeDecision: z.enum(VISUAL_TARGET_TARGET_TYPE_DECISIONS),
  selectionDecision: z.enum(VISUAL_TARGET_SELECTION_DECISIONS),
  ambiguityDecision: z.enum(VISUAL_TARGET_AMBIGUITY_DECISIONS),
  outputBoundaryDecision: VisualTargetOutputBoundaryDecisionSchema,
  criticalDataQualityDecision: VisualTargetCriticalDataQualityDecisionSchema,
  dataQualityFlags: z.array(VisualTargetDataQualityFlagSchema).max(30),
  geometryGuardHandoffPolicy: z.literal(VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY),
  nonExecutableCoordinatePolicy: z.literal(VISUAL_TARGET_NON_EXECUTABLE_COORDINATE_POLICY),
  clock: z.object({
    portKind: z.literal(VISUAL_TARGET_CLOCK_KIND),
    startedMonotonicMs: finiteNumber,
    endedMonotonicMs: finiteNumber,
  }).strict(),
}).strict();

const validateVisualTargetRuntimeProof = (value: z.infer<typeof VisualTargetRuntimeProofBaseSchema>, context: z.RefinementCtx): void => {
  if (value.startedAt > value.endedAt) context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  if (!(value.status === "failed" && value.failureReason === "input_schema_invalid")) {
    addChainFieldRequirementIssues(value as Record<string, unknown>, context, "runtimeProof");
  }
  validateVisualTargetRuntimeProofRefs(value, context);
};
const validateVisualTargetRuntimeProofRefs = (value: z.infer<typeof VisualTargetRuntimeProofBaseSchema>, context: z.RefinementCtx): void => {
  if (value.status === "success" && value.outputRef === null) context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires outputRef", path: ["outputRef"] });
  if (value.status !== "success" && value.outputRef !== null) context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must keep outputRef null", path: ["outputRef"] });
  if (value.status !== "success" && value.diagnosticPayloadRef === null) context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must keep diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
};
const VisualTargetRuntimeProofSchema = VisualTargetRuntimeProofBaseSchema.superRefine(validateVisualTargetRuntimeProof);
const VisualTargetAbilityResultSchemaBase = VisualTargetResultSchema.and(z.object({ runtimeProof: VisualTargetRuntimeProofSchema }));
const validateVisualTargetAbilityResultChainParity = (
  resultRecord: Record<string, unknown>,
  proofRecord: Record<string, unknown>,
  isInvalidInputFailure: boolean,
  context: z.RefinementCtx,
): void => {
  for (const fieldName of VISUAL_TARGET_CHAIN_FIELD_NAMES) {
    if (!isInvalidInputFailure && resultRecord[fieldName] == null) context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} is required in result`, path: [fieldName] });
    if (resultRecord[fieldName] !== proofRecord[fieldName]) context.addIssue({ code: z.ZodIssueCode.custom, message: `runtimeProof.${fieldName} must equal result.${fieldName}`, path: ["runtimeProof", fieldName] });
  }
};
const validateVisualTargetAbilityResult = (value: z.infer<typeof VisualTargetAbilityResultSchemaBase>, context: z.RefinementCtx): void => {
  const isInvalidInputFailure = value.status === "failed" && value.failureReason === "input_schema_invalid";
  const resultRecord = value as Record<string, unknown>, proofRecord = value.runtimeProof as Record<string, unknown>;
  if (value.runtimeProof.status !== value.status) context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  validateVisualTargetAbilityResultChainParity(resultRecord, proofRecord, isInvalidInputFailure, context);
  if (value.status === "success" && value.output === null) context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires output", path: ["output"] });
  if (value.status !== "success" && value.output !== null) context.addIssue({ code: z.ZodIssueCode.custom, message: "failed/review_required result must keep output null", path: ["output"] });
};
const VisualTargetAbilityResultSchema = VisualTargetAbilityResultSchemaBase.superRefine(validateVisualTargetAbilityResult);
export { VisualTargetChildCapabilityIdSchema, VisualTargetStatusSchema, VisualTargetTypeSchema, VisualTargetNatureSchema, VisualTargetCandidateKindSchema, VisualTargetCoordinateSpaceSchema, VisualTargetFailureReasonSchema, VisualTargetDataQualityFlagSchema, VisualTargetPayloadBudgetDecisionSchema, VisualTargetOutputBoundaryDecisionSchema, VisualTargetSourceBindingDecisionSchema, VisualTargetCriticalDataQualityDecisionSchema, VisualTargetGeometryHandoffDecisionSchema, VisualBoundingBoxSchema, VisualClickPointSchema, VisualTargetScaleMappingSchema, VisualTargetScreenshotSourceProofSchema, VisualTargetAiSourceProofSchema, VisualTargetPageStateProofSchema, VisualTargetOperatorApprovalProofSchema, VisualTargetSourceProofSchema, VisualTargetCandidateSchema, VisualTargetAbilityInputSchema, VisualTargetGeometryGuardHandoffSchema, VisualTargetActionOutputSchema, VisualTargetRegionOutputSchema, VisualTargetMetricOutputSchema, VisualTargetOutputSchema, VisualTargetActionSuccessResultSchema, VisualTargetRegionSuccessResultSchema, VisualTargetMetricSuccessResultSchema, VisualTargetNonSuccessResultSchema, VisualTargetInvalidInputFailureResultSchema, VisualTargetResultSchema, VisualTargetCandidateScoreTraceSchema, VisualTargetRuntimeProofSchema, VisualTargetAbilityResultSchema };
