import { z } from "zod";

export const POST_ACTION_VERIFICATION_ABILITY_GROUP_ID = "post-action-verification";

export const PostActionVerificationChildCapabilityIdSchema = z.enum([
  "verify-page-opened",
  "verify-comments-panel-opened",
  "verify-comments-panel-closed",
  "verify-video-changed-after-scroll",
  "verify-not-interested-result",
  "verify-target-state-changed",
]);

export const PostActionVerificationDecisionSchema = z.enum([
  "verified",
  "failed",
  "review_required",
]);

export const PostActionVerificationStatusSchema = z.enum(["success", "failed"]);

export const PostActionFailureReasonSchema = z.enum([
  "missing_action_log_ref",
  "missing_expected_outcome",
  "missing_verification_policy",
  "missing_after_evidence",
  "missing_before_after_evidence",
  "missing_observation_support",
  "self_reported_success_only",
  "unexpected_state",
  "insufficient_evidence",
  "conflicting_observation",
  "verification_execution_failed",
]);

export const PostActionObservationKindSchema = z.enum([
  "page_state",
  "ai_observation",
  "visual_target",
  "screenshot_diff",
  "video_identity",
  "action_completion",
]);

export const PostActionExpectedOutcomeSchema = z.object({
  outcomeType: z.enum([
    "page_opened",
    "comments_panel_opened",
    "comments_panel_closed",
    "video_changed_after_scroll",
    "not_interested_result",
    "target_state_changed",
  ]),
  description: z.string().min(1),
  expectedUrlHost: z.string().min(1).nullable().default(null),
  expectedUrlPrefix: z.string().min(1).nullable().default(null),
  expectedState: z.string().min(1).nullable().default(null),
  expectedTargetType: z.string().min(1).nullable().default(null),
  requiresBeforeAfterComparison: z.boolean().default(false),
  requiresVisualEvidence: z.boolean().default(false),
});

export const PostActionObservationRefSchema = z.object({
  kind: PostActionObservationKindSchema,
  ref: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().default(null),
});

export const PostActionConfidencePolicySchema = z.object({
  minimumConfidence: z.number().min(0).max(1),
  allowReviewRequired: z.boolean().default(true),
});

export const PostActionVerificationPolicySchema = z.object({
  verificationMode: z.enum(["visual_evidence", "observation_only", "before_after_comparison"]),
  requireAfterEvidence: z.boolean().default(false),
  requireBeforeAfterComparison: z.boolean().default(false),
  allowSelfReportedSuccess: z.boolean().default(false),
});

export const PostActionVerificationAbilityInputSchema = z.object({
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema,
  actionLogRef: z.string().min(1),
  sourceAbilityGroupId: z.string().min(1),
  sourceActionType: z.string().min(1),
  expectedOutcome: PostActionExpectedOutcomeSchema,
  beforeEvidenceRef: z.string().min(1).nullable().default(null),
  afterEvidenceRef: z.string().min(1).nullable().default(null),
  pageStateRef: z.string().min(1).nullable().default(null),
  aiObservationRef: z.string().min(1).nullable().default(null),
  visualTargetRef: z.string().min(1).nullable().default(null),
  screenshotDiffRef: z.string().min(1).nullable().default(null),
  requestedBy: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  confidencePolicy: PostActionConfidencePolicySchema,
  verificationPolicy: PostActionVerificationPolicySchema,
  observationRefs: z.array(PostActionObservationRefSchema).default([]),
});

export const PostActionVerificationAbilityResultSchema = z.object({
  status: PostActionVerificationStatusSchema,
  abilityGroupId: z.literal(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID),
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema,
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  actionLogRef: z.string().min(1),
  expectedOutcome: PostActionExpectedOutcomeSchema,
  observedOutcome: z.string().min(1),
  verificationDecision: PostActionVerificationDecisionSchema,
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  observationRefs: z.array(z.string().min(1)).default([]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().min(0),
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  debugLogRef: z.string().min(1),
});

export type PostActionVerificationAbilityGroupId = typeof POST_ACTION_VERIFICATION_ABILITY_GROUP_ID;
export type PostActionVerificationChildCapabilityId = z.infer<typeof PostActionVerificationChildCapabilityIdSchema>;
export type PostActionVerificationDecision = z.infer<typeof PostActionVerificationDecisionSchema>;
export type PostActionVerificationStatus = z.infer<typeof PostActionVerificationStatusSchema>;
export type PostActionFailureReason = z.infer<typeof PostActionFailureReasonSchema>;
export type PostActionObservationKind = z.infer<typeof PostActionObservationKindSchema>;
export type PostActionExpectedOutcome = z.infer<typeof PostActionExpectedOutcomeSchema>;
export type PostActionObservationRef = z.infer<typeof PostActionObservationRefSchema>;
export type PostActionConfidencePolicy = z.infer<typeof PostActionConfidencePolicySchema>;
export type PostActionVerificationPolicy = z.infer<typeof PostActionVerificationPolicySchema>;
export type PostActionVerificationAbilityInput = z.infer<typeof PostActionVerificationAbilityInputSchema>;
export type PostActionVerificationAbilityResult = z.infer<typeof PostActionVerificationAbilityResultSchema>;

export interface PostActionVerificationChildCapability {
  readonly abilityGroupId: PostActionVerificationAbilityGroupId;
  readonly childCapabilityId: PostActionVerificationChildCapabilityId;

  execute(input: PostActionVerificationAbilityInput): Promise<PostActionVerificationAbilityResult>;
}

export interface PostActionVerificationAbilityGroup {
  listChildCapabilityIds(): PostActionVerificationChildCapabilityId[];
  execute(input: PostActionVerificationAbilityInput): Promise<PostActionVerificationAbilityResult>;
}