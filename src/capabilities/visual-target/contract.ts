import { z } from "zod";

export const VISUAL_TARGET_ABILITY_GROUP_ID = "visual-target";

export const VisualTargetChildCapabilityIdSchema = z.enum([
  "detect-comments-button",
  "detect-not-interested-button",
  "detect-next-video-region",
  "detect-like-button",
  "detect-save-button",
  "detect-comments-panel",
  "detect-close-comments-button",
  "detect-metric-like-count",
  "detect-metric-comment-count",
]);

export const VisualTargetTypeSchema = z.enum([
  "video_area",
  "current_video_content",
  "like_button",
  "save_button",
  "comments_button",
  "comments_panel",
  "close_comments_button",
  "not_interested_button",
  "next_video_region",
  "scroll_area",
  "login_wall",
  "captcha_challenge",
  "safety_page",
  "unknown_ui",
  "metric_like_count",
  "metric_comment_count",
  "metric_share_count",
  "metric_save_count",
]);

export const VisualBoundingBoxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const VisualClickPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const VisualTargetCoordinateSpaceSchema = z.enum([
  "browser_viewport",
  "desktop_screen",
  "source_image",
  "contact_sheet",
  "ai_input",
]);

export const VisualTargetFailureReasonSchema = z.enum([
  "no_candidates",
  "ambiguous_candidates",
  "invalid_target_type",
  "missing_bounding_box",
  "missing_click_point",
  "click_point_outside_bounding_box",
  "confidence_below_threshold",
  "missing_source_screenshot",
  "missing_coordinate_space",
  "contact_sheet_coordinate_forbidden",
  "ai_input_scale_mapping_missing",
  "missing_candidate_ref",
]);

export const VisualTargetScaleMappingSchema = z.object({
  cropOffsetX: z.number().finite(),
  cropOffsetY: z.number().finite(),
  scaleX: z.number().finite(),
  scaleY: z.number().finite(),
  sourceCoordinateSpace: VisualTargetCoordinateSpaceSchema.exclude(["contact_sheet", "ai_input"]),
});

export const VisualTargetCandidateSourceKindSchema = z.enum([
  "ai_candidate",
  "heuristic_profile",
  "operator_manual",
]);

export const VisualTargetCandidateSchema = z.object({
  sourceCandidateRef: z.string().min(1).nullable().default(null),
  sourceAiResultRef: z.string().min(1).nullable().default(null),
  sourceKind: VisualTargetCandidateSourceKindSchema.default("ai_candidate"),
  targetType: VisualTargetTypeSchema.nullable().default(null),
  boundingBox: VisualBoundingBoxSchema.nullable().default(null),
  clickPoint: VisualClickPointSchema.nullable().default(null),
  confidence: z.number().min(0).max(1),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.nullable().default(null),
  scaleMapping: VisualTargetScaleMappingSchema.nullable().default(null),
  visibleText: z.string().min(1).nullable().default(null),
  uncertainty: z.array(z.string().min(1)).default([]),
  blockedReason: z.string().min(1).nullable().default(null),
  detectionMethod: z.string().min(1),
  isVisible: z.boolean().default(true),
  expectedRegionDistance: z.number().nonnegative().nullable().default(null),
});

export const VisualTargetConfidencePolicySchema = z.object({
  minConfidence: z.number().min(0).max(1).default(0.72),
});

export const VisualTargetSelectionPolicySchema = z.object({
  strategy: z.enum(["highestConfidence", "nearestExpectedRegion", "firstVisible", "rejectAmbiguous"]).default("highestConfidence"),
  ambiguityConfidenceDelta: z.number().nonnegative().default(0.05),
});

export const VisualTargetDataQualityPolicySchema = z.object({
  requireCandidateRef: z.boolean().default(true),
  rejectContactSheetCoordinates: z.boolean().default(true),
  requireScaleMappingForAiInput: z.boolean().default(true),
});

export const VisualTargetAbilityInputSchema = z.object({
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  targetType: VisualTargetTypeSchema,
  sourceScreenshotEvidenceId: z.string().min(1),
  coordinateSpace: VisualTargetCoordinateSpaceSchema,
  sourceAiResultRef: z.string().min(1).nullable().default(null),
  candidates: z.array(VisualTargetCandidateSchema).default([]),
  requestedBy: z.string().min(1),
  confidencePolicy: VisualTargetConfidencePolicySchema.nullable().default(null),
  selectionPolicy: VisualTargetSelectionPolicySchema.nullable().default(null),
  dataQualityPolicy: VisualTargetDataQualityPolicySchema.nullable().default(null),
});

export const VisualTargetSchema = z.object({
  targetId: z.string().min(1).nullable().default(null),
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  status: z.enum(["success", "failed", "review_required"]),
  targetType: VisualTargetTypeSchema,
  sourceScreenshotEvidenceId: z.string().min(1),
  sourceAiResultRef: z.string().min(1).nullable().default(null),
  sourceCandidateRef: z.string().min(1).nullable().default(null),
  coordinateSpace: VisualTargetCoordinateSpaceSchema.nullable().default(null),
  boundingBox: VisualBoundingBoxSchema.nullable().default(null),
  clickPoint: VisualClickPointSchema.nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  requiresGeometryGuard: z.boolean().default(true),
  detectionMethod: z.string().min(1).nullable().default(null),
  visibleText: z.string().min(1).nullable().default(null),
  uncertainty: z.array(z.string().min(1)).default([]),
  blockedReason: z.string().min(1).nullable().default(null),
  failureReason: VisualTargetFailureReasonSchema.nullable().default(null),
  debugLogRef: z.string().min(1),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});

export const VisualTargetAbilityResultSchema = VisualTargetSchema;

export type VisualTargetChildCapabilityId = z.infer<typeof VisualTargetChildCapabilityIdSchema>;
export type VisualTargetType = z.infer<typeof VisualTargetTypeSchema>;
export type VisualBoundingBox = z.infer<typeof VisualBoundingBoxSchema>;
export type VisualClickPoint = z.infer<typeof VisualClickPointSchema>;
export type VisualTargetCoordinateSpace = z.infer<typeof VisualTargetCoordinateSpaceSchema>;
export type VisualTargetFailureReason = z.infer<typeof VisualTargetFailureReasonSchema>;
export type VisualTargetScaleMapping = z.infer<typeof VisualTargetScaleMappingSchema>;
export type VisualTargetCandidate = z.infer<typeof VisualTargetCandidateSchema>;
export type VisualTargetConfidencePolicy = z.infer<typeof VisualTargetConfidencePolicySchema>;
export type VisualTargetSelectionPolicy = z.infer<typeof VisualTargetSelectionPolicySchema>;
export type VisualTargetDataQualityPolicy = z.infer<typeof VisualTargetDataQualityPolicySchema>;
export type VisualTargetAbilityInput = z.infer<typeof VisualTargetAbilityInputSchema>;
export type VisualTarget = z.infer<typeof VisualTargetSchema>;
export type VisualTargetAbilityResult = z.infer<typeof VisualTargetAbilityResultSchema>;

export type SuccessfulVisualTarget = VisualTargetAbilityResult & {
  status: "success";
  targetId: string;
  coordinateSpace: VisualTargetCoordinateSpace;
  boundingBox: VisualBoundingBox;
  clickPoint: VisualClickPoint;
  confidence: number;
};

export type VisualTargetAbilityContext = {
  defaultConfidencePolicy: VisualTargetConfidencePolicy;
  defaultSelectionPolicy: VisualTargetSelectionPolicy;
  defaultDataQualityPolicy: VisualTargetDataQualityPolicy;
};

export interface VisualTargetChildCapability {
  readonly abilityGroupId: typeof VISUAL_TARGET_ABILITY_GROUP_ID;
  readonly childCapabilityId: VisualTargetChildCapabilityId;

  execute(input: VisualTargetAbilityInput, context: VisualTargetAbilityContext): Promise<VisualTargetAbilityResult>;
}

export interface VisualTargetAbilityGroup {
  listChildCapabilityIds(): VisualTargetChildCapabilityId[];
  execute(input: VisualTargetAbilityInput): Promise<VisualTargetAbilityResult>;
}