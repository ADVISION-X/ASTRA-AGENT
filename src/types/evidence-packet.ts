import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";
import {
  MultiFrameSamplingStrategySchema,
  ProductPresenceInputModeSchema,
  VideoFrameSamplePointSchema,
} from "./multi-frame-evidence.js";
import { VisionProductPresenceFrameObservationSchema } from "./vision-product-presence.js";

export const EvidencePacketRoundOutcomeSchema = z.enum([
  "candidate_created",
  "video_only_candidate_created",
  "comments_unavailable_candidate_created",
  "metrics_unavailable_candidate_created",
  "browse_ledger_recorded",
  "skipped_non_product",
  "skipped_uncertain",
  "skipped_duplicate",
  "skipped_unstable_video",
  "blocked_login",
  "blocked_captcha",
  "blocked_safety_page",
  "local_ai_unavailable",
  "invalid_ai_output",
  "geometry_mismatch",
  "review_required",
  "failed_with_reason",
]);

export const BrowseLedgerOutcomeSchema = z.enum([
  "product_no_high_confidence",
  "skipped_uncertain",
  "skipped_duplicate",
  "skipped_unstable_video",
  "ordinary_scroll_next",
  "blocked",
]);

export const BrowseLedgerProductPresenceDecisionSchema = z.enum([
  "product_yes_high_confidence",
  "product_no_high_confidence",
  "product_uncertain",
  "review_required",
  "not_asked",
]);

export const RoundStructuralDecisionSchema = z.enum([
  "product_yes_high_confidence",
  "product_no_high_confidence",
  "product_uncertain",
  "local_ai_unavailable",
  "blocked_login",
  "blocked_captcha",
  "blocked_safety_page",
  "unknown_ui",
  "geometry_mismatch",
  "invalid_ai_output",
  "review_required",
  "not_asked",
]);

export const RoundArtifactKindSchema = z.enum([
  "evidence_packet",
  "browse_ledger",
  "failed_packet",
]);

export const RoundLifecycleStepSchema = z.enum([
  "task_start",
  "open_target_page",
  "detect_login_or_safety",
  "wait_feed_ready",
  "single_video_round_start",
  "wait_video_stable",
  "identify_current_video",
  "calibrate_geometry",
  "screenshot_video_area",
  "record_video_evidence",
  "ask_ai_product_presence",
  "validate_ai_output",
  "branch",
  "collect_pre_action_metrics",
  "like_or_save_marker",
  "open_comments",
  "screenshot_comments",
  "extract_visible_comments",
  "summarize_comment_signals",
  "create_pending_candidate",
  "create_video_only_pending_candidate",
  "finalize_evidence_packet",
  "finalize_browse_ledger",
  "finalize_failed_or_review_record",
  "decide_negative_action",
  "click_not_interested",
  "scroll_next_video",
  "record_skip_reason",
  "record_round_complete",
  "review_required",
  "stop",
]);

export const RoundLifecycleEventStatusSchema = z.enum([
  "entered",
  "completed",
  "skipped",
  "failed",
]);

export const EvidencePacketActionPurposeSchema = z.enum([
  "initialize_discovery",
  "detect_page_safety",
  "wait_for_feed",
  "wait_for_video_stability",
  "identify_video",
  "calibrate_geometry",
  "collect_video_evidence",
  "ask_product_presence",
  "collect_pre_action_metrics",
  "recommendation_tuning_marker",
  "collect_comment_evidence",
  "reduce_non_product_recommendations",
  "continue_discovery",
  "finalize_evidence_packet",
  "finalize_browse_ledger",
  "finalize_failed_or_review_record",
  "observe_video_context",
  "runtime_support",
]);

export const EvidencePacketActionTriggerSourceSchema = z.enum([
  "local_ai_output",
  "runtime_policy",
  "operator_instruction",
  "platform_guard",
  "review_gate",
]);

export const EvidencePacketDataQualityFlagSchema = z.enum([
  "video_screenshot_ok",
  "video_screenshot_missing",
  "comment_screenshot_ok",
  "comment_screenshot_missing",
  "metrics_complete",
  "metrics_partially_unavailable",
  "local_ai_ok",
  "local_ai_unavailable",
  "local_ai_low_confidence",
  "ocr_ok",
  "ocr_low_quality",
  "comment_panel_failed",
  "geometry_calibrated",
  "geometry_mismatch",
  "duplicate_video",
  "review_required",
  "video_only_candidate",
  "richer_candidate",
]);

export const EvidencePacketPageStateSchema = z.object({
  currentUrl: z.string().min(1),
  loginState: z.string().min(1),
  safetyState: z.string().min(1),
  feedReadyStatus: z.string().min(1),
  videoStableStatus: z.string().min(1),
  geometryStatus: z.string().min(1),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
});

export const EvidencePacketVideoEvidenceSchema = z.object({
  multiFrameEvidenceSetId: z.string().min(1),
  frames: z.array(VideoFrameSamplePointSchema).min(1),
  contactSheetEvidenceId: z.string().min(1).nullable().default(null),
  samplingStrategy: MultiFrameSamplingStrategySchema,
  validFrameCount: z.number().int().nonnegative(),
});

export const EvidencePacketProductPresenceAISchema = z.object({
  promptId: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  inputMode: ProductPresenceInputModeSchema,
  sampledFrameCount: z.number().int().positive(),
  validFrameCount: z.number().int().nonnegative(),
  modelRole: z.string().min(1),
  modelNameOrToolName: z.string().min(1),
  isProductVideo: z.boolean().nullable(),
  confidence: z.number().min(0).max(1),
  visibleProductTypes: z.array(z.string().min(1)).default([]),
  evidenceObservations: z.array(z.string().min(1)).default([]),
  frameLevelObservations: z.array(z.lazy(() => VisionProductPresenceFrameObservationSchema)).default([]),
  aggregateReason: z.string().min(1),
  reason: z.string().min(1),
  uncertainty: z.array(z.string().min(1)).default([]),
  mustReview: z.boolean(),
});

export const EvidencePacketPreActionMetricsSchema = z.object({
  likeCount: z.number().int().nonnegative().nullable().default(null),
  commentCount: z.number().int().nonnegative().nullable().default(null),
  shareCount: z.number().int().nonnegative().nullable().default(null),
  saveCount: z.number().int().nonnegative().nullable().default(null),
  metricCaptureStage: z.enum(["pre_action", "post_action"]),
  unavailableReasons: z.array(z.string().min(1)).default([]),
});

export const EvidencePacketActionSchema = z.object({
  actionLogId: z.string().min(1),
  actionType: z.string().min(1),
  actionPurpose: EvidencePacketActionPurposeSchema,
  triggerSource: EvidencePacketActionTriggerSourceSchema,
  beforeEvidenceId: z.string().min(1).nullable().default(null),
  afterEvidenceId: z.string().min(1).nullable().default(null),
  result: z.enum(["success", "skipped", "failed"]),
  failureReason: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
});

export const EvidencePacketCommentEvidenceSchema = z.object({
  commentPanelOpened: z.boolean(),
  commentScreenshotEvidenceIds: z.array(z.string().min(1)).default([]),
  ocrTextRecordIds: z.array(z.string().min(1)).default([]),
  visibleCommentCount: z.number().int().nonnegative(),
  commentCaptureLimit: z.number().int().positive(),
  failureReason: z.string().min(1).nullable().default(null),
});

export const EvidencePacketCommentSignalsSchema = z.object({
  whereToBuyQuestions: z.array(z.string().min(1)).default([]),
  priceQuestions: z.array(z.string().min(1)).default([]),
  purchaseIntent: z.array(z.string().min(1)).default([]),
  qualityConcerns: z.array(z.string().min(1)).default([]),
  problemComplaints: z.array(z.string().min(1)).default([]),
  repeatedDemandTerms: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1),
  uncertainty: z.array(z.string().min(1)).default([]),
});

export const EvidencePacketCandidateRefSchema = z.object({
  candidateId: z.string().min(1).nullable().default(null),
  status: z.literal("pending_analysis"),
  candidateType: z.enum(["video_only", "richer_candidate", "none"]),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
});

export const EvidencePacketAdvancedAIExportBoundarySchema = z.object({
  included: z.boolean(),
  exportVersion: z.string().min(1),
  allowedUse: z.array(z.string().min(1)).default([]),
  forbiddenUse: z.array(z.string().min(1)).default([]),
});

export const BrowseLedgerEntrySchema = z.object({
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  observedAt: z.string().datetime(),
  browseOutcome: BrowseLedgerOutcomeSchema,
  productPresenceDecision: BrowseLedgerProductPresenceDecisionSchema,
  confidence: z.number().min(0).max(1).nullable().default(null),
  skipReason: z.string().min(1).nullable().default(null),
  actionLogRefs: z.array(z.string().min(1)).default([]),
  lightweightOnly: z.literal(true),
});

export const RoundStructuralLogSchema = z.object({
  logId: z.string().min(1),
  sessionId: z.string().min(1),
  taskRunId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  packetId: z.string().min(1).nullable().default(null),
  finalArtifactKind: RoundArtifactKindSchema,
  productPresenceDecision: RoundStructuralDecisionSchema,
  browseOutcome: BrowseLedgerOutcomeSchema.nullable().default(null),
  roundOutcome: EvidencePacketRoundOutcomeSchema,
  decisionReason: z.string().min(1),
  nextStep: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  actionLogRefs: z.array(z.string().min(1)).default([]),
  aiResultRefs: z.array(z.string().min(1)).default([]),
  candidateId: z.string().min(1).nullable().default(null),
  dataQualityFlags: z.array(EvidencePacketDataQualityFlagSchema).default([]),
  exportIncluded: z.boolean(),
  lightweightOnly: z.boolean(),
});

export const RoundLifecycleEventSchema = z.object({
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
  taskRunId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  step: RoundLifecycleStepSchema,
  status: RoundLifecycleEventStatusSchema,
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const BrowseSummarySchema = z.object({
  sessionId: z.string().min(1),
  totalSeenCount: z.number().int().nonnegative(),
  productYesCount: z.number().int().nonnegative(),
  productNoCount: z.number().int().nonnegative(),
  uncertainCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  unstableCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  evidencePacketCount: z.number().int().nonnegative(),
  exportPacketCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});

export const AdvancedAIExportSetSchema = z.object({
  exportId: z.string().min(1),
  exportVersion: z.string().min(1),
  sessionId: z.string().min(1),
  evidencePacketIds: z.array(z.string().min(1)).default([]),
  packetCount: z.number().int().nonnegative(),
  browseSummary: BrowseSummarySchema,
  excludedBrowseLedgerByDefault: z.literal(true),
});

export const ProductDiscoveryEvidencePacketSchema = z.object({
  packetId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  sourcePlatform: z.string().min(1),
  sourceUrl: z.string().min(1),
  capturedAt: z.string().datetime(),
  roundOutcome: EvidencePacketRoundOutcomeSchema,
  nextStep: z.string().min(1),
  pageState: EvidencePacketPageStateSchema,
  videoEvidence: EvidencePacketVideoEvidenceSchema,
  productPresenceAI: EvidencePacketProductPresenceAISchema,
  preActionMetrics: EvidencePacketPreActionMetricsSchema,
  actions: z.array(EvidencePacketActionSchema).default([]),
  commentEvidence: EvidencePacketCommentEvidenceSchema,
  commentSignals: EvidencePacketCommentSignalsSchema,
  candidate: EvidencePacketCandidateRefSchema,
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  actionLogRefs: z.array(z.string().min(1)).default([]),
  aiResultRefs: z.array(z.string().min(1)).default([]),
  dataQualityFlags: z.array(EvidencePacketDataQualityFlagSchema).default([]),
  exportForAdvancedAI: EvidencePacketAdvancedAIExportBoundarySchema,
});

export type EvidencePacketPageState = z.infer<typeof EvidencePacketPageStateSchema>;
export type EvidencePacketVideoEvidence = z.infer<typeof EvidencePacketVideoEvidenceSchema>;
export type EvidencePacketProductPresenceAI = z.infer<typeof EvidencePacketProductPresenceAISchema>;
export type EvidencePacketPreActionMetrics = z.infer<typeof EvidencePacketPreActionMetricsSchema>;
export type EvidencePacketAction = z.infer<typeof EvidencePacketActionSchema>;
export type EvidencePacketCommentEvidence = z.infer<typeof EvidencePacketCommentEvidenceSchema>;
export type EvidencePacketCommentSignals = z.infer<typeof EvidencePacketCommentSignalsSchema>;
export type EvidencePacketCandidateRef = z.infer<typeof EvidencePacketCandidateRefSchema>;
export type EvidencePacketDataQualityFlag = z.infer<typeof EvidencePacketDataQualityFlagSchema>;
export type EvidencePacketRoundOutcome = z.infer<typeof EvidencePacketRoundOutcomeSchema>;
export type EvidencePacketActionPurpose = z.infer<typeof EvidencePacketActionPurposeSchema>;
export type EvidencePacketActionTriggerSource = z.infer<typeof EvidencePacketActionTriggerSourceSchema>;
export type EvidencePacketAdvancedAIExportBoundary = z.infer<typeof EvidencePacketAdvancedAIExportBoundarySchema>;
export type BrowseLedgerOutcome = z.infer<typeof BrowseLedgerOutcomeSchema>;
export type BrowseLedgerProductPresenceDecision = z.infer<typeof BrowseLedgerProductPresenceDecisionSchema>;
export type RoundStructuralDecision = z.infer<typeof RoundStructuralDecisionSchema>;
export type RoundArtifactKind = z.infer<typeof RoundArtifactKindSchema>;
export type BrowseLedgerEntry = z.infer<typeof BrowseLedgerEntrySchema>;
export type RoundStructuralLog = z.infer<typeof RoundStructuralLogSchema>;
export type RoundLifecycleStep = z.infer<typeof RoundLifecycleStepSchema>;
export type BrowseRoundStep = RoundLifecycleStep;
export type RoundLifecycleEventStatus = z.infer<typeof RoundLifecycleEventStatusSchema>;
export type RoundLifecycleEvent = z.infer<typeof RoundLifecycleEventSchema>;
export type BrowseSessionSummary = z.infer<typeof BrowseSummarySchema>;
export type AdvancedAIExportSet = z.infer<typeof AdvancedAIExportSetSchema>;
export type ProductDiscoveryEvidencePacket = z.infer<typeof ProductDiscoveryEvidencePacketSchema>;