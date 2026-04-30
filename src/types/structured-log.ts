import { z } from "zod";

import { AgentSkillCategorySchema } from "./agent-skill.js";
import { EvidenceRefSchema } from "./evidence.js";
import {
  EvidencePacketActionPurposeSchema,
  EvidencePacketActionTriggerSourceSchema,
  RoundLifecycleStepSchema,
} from "./evidence-packet.js";
import {
  VisualActionVerificationResultSchema,
  VisualBoundingBoxSchema,
  VisualTargetTypeSchema,
} from "./visual-action.js";
import {
  MultiFrameSamplingStrategySchema,
  VideoFrameSamplePointLabelSchema,
} from "./multi-frame-evidence.js";

const nullableString = z.string().min(1).nullable().default(null);

export const StructuredRuntimeLogLevelSchema = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]);

export const StructuredLogStatusSchema = z.enum(["started", "success", "failed", "skipped", "review_required"]);

export const StructuredRuntimeEventTypeSchema = z.string().min(1);

export const StructuredActionTypeSchema = RoundLifecycleStepSchema;

export const StructuredActionPurposeSchema = EvidencePacketActionPurposeSchema;

export const StructuredLogRefSchema = z.object({
  refId: z.string().min(1),
  refType: z.enum(["evidence", "action_log", "ai_result", "ledger", "packet", "snapshot", "other"]),
  label: z.string().min(1).nullable().default(null),
});

export const StructuredRuntimeMissingFrameSchema = z.object({
  frameLabel: VideoFrameSamplePointLabelSchema,
  unavailableReason: z.string().min(1),
});

export const StructuredAiImageInputSchema = z.object({
  refId: nullableString,
  artifactRef: nullableString,
  filePath: nullableString,
  hash: nullableString,
  bytes: z.number().int().nonnegative().nullable().default(null),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
});

export const StructuredRuntimeSnapshotSummarySchema = z.object({
  runtimeStatus: z.string().min(1),
  currentStep: z.string().min(1),
  latestRoundOutcome: z.string().min(1).nullable().default(null),
  latestProductPresenceDecision: z.string().min(1).nullable().default(null),
  latestVideoEvidenceId: z.string().min(1).nullable().default(null),
  latestBrowseLedgerEntryId: z.string().min(1).nullable().default(null),
  latestEvidencePacketId: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  counters: z.object({
    totalSeenCount: z.number().int().nonnegative(),
    candidateCount: z.number().int().nonnegative(),
    actionLogCount: z.number().int().nonnegative(),
    evidencePacketCount: z.number().int().nonnegative(),
    browseLedgerCount: z.number().int().nonnegative(),
  }),
});

export const StructuredRuntimeEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: StructuredRuntimeEventTypeSchema,
  level: StructuredRuntimeLogLevelSchema.default("INFO"),
  phase: nullableString,
  component: nullableString,
  owner: nullableString,
  abilityGroupId: z.string().min(1).default("orchestration"),
  childCapabilityId: nullableString,
  skillId: nullableString,
  skillCategory: AgentSkillCategorySchema.nullable().default(null),
  sessionId: z.string().min(1),
  missionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
  mapId: nullableString,
  stepId: nullableString,
  taskTemplateId: nullableString,
  traceId: nullableString,
  spanId: nullableString,
  attemptId: nullableString,
  browserProfileRef: nullableString,
  loginState: nullableString,
  step: RoundLifecycleStepSchema,
  previousStep: RoundLifecycleStepSchema.nullable().default(null),
  nextStep: RoundLifecycleStepSchema.nullable().default(null),
  status: StructuredLogStatusSchema,
  reason: nullableString,
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
  actionableMessage: nullableString,
  ownerResponsible: nullableString,
  decision: nullableString,
  roundOutcome: nullableString,
  finalizationType: z.enum(["browse_ledger", "evidence_packet", "failed_record"]).nullable().default(null),
  samplingStrategy: MultiFrameSamplingStrategySchema.nullable().default(null),
  expectedFrameCount: z.number().int().positive().nullable().default(null),
  validFrameCount: z.number().int().nonnegative().nullable().default(null),
  fallbackReason: nullableString,
  missingFrames: z.array(StructuredRuntimeMissingFrameSchema).default([]),
  snapshotSummary: StructuredRuntimeSnapshotSummarySchema.nullable().default(null),
  provider: nullableString,
  model: nullableString,
  modelRole: nullableString,
  runtime: nullableString,
  promptContractId: nullableString,
  promptVersion: nullableString,
  outputSchemaRef: nullableString,
  promptDebugRef: nullableString,
  systemPromptHash: nullableString,
  userPromptHash: nullableString,
  promptPreview: nullableString,
  promptFullText: nullableString,
  rawResponsePreview: nullableString,
  rawResponseText: nullableString,
  rawResponseHash: nullableString,
  rawResponseRef: nullableString,
  parsedJson: z.unknown().nullable().default(null),
  parsedDecision: nullableString,
  parserErrors: z.array(z.string().min(1)).default([]),
  sourceScreenshotEvidenceId: nullableString,
  aiInputArtifactRef: nullableString,
  imageInputs: z.array(StructuredAiImageInputSchema).default([]),
  tokenEstimate: z.number().int().nonnegative().nullable().default(null),
  exitCode: z.number().int().nullable().default(null),
  signal: nullableString,
  pid: z.number().int().positive().nullable().default(null),
  startedAt: nullableString,
  endedAt: nullableString,
  lastRuntimeEventId: nullableString,
  lastCommandEventId: nullableString,
  lastAiEventId: nullableString,
  likelyCauseRef: nullableString,
  crashBundleRef: nullableString,
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().default(null),
  refs: z.array(z.string().min(1)).default([]),
  inputRefs: z.array(EvidenceRefSchema).default([]),
  outputRefs: z.array(EvidenceRefSchema).default([]),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  proofRefs: z.array(z.string().min(1)).default([]),
  artifactRefs: z.array(z.string().min(1)).default([]),
  actionLogRefs: z.array(z.string().min(1)).default([]),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
});

export const StructuredActionLogSchema = z.object({
  actionLogId: z.string().min(1),
  abilityGroupId: z.string().min(1).default("orchestration"),
  childCapabilityId: z.string().min(1).nullable().default(null),
  skillId: z.string().min(1).nullable().default(null),
  skillCategory: AgentSkillCategorySchema.nullable().default(null),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  browserProfileRef: z.string().min(1).nullable().default(null),
  loginState: z.string().min(1).nullable().default(null),
  step: RoundLifecycleStepSchema,
  actionType: StructuredActionTypeSchema,
  actionPurpose: StructuredActionPurposeSchema,
  triggerSource: EvidencePacketActionTriggerSourceSchema,
  inputRefs: z.array(EvidenceRefSchema).default([]),
  outputRefs: z.array(EvidenceRefSchema).default([]),
  beforeEvidenceId: z.string().min(1).nullable().default(null),
  afterEvidenceId: z.string().min(1).nullable().default(null),
  targetDescriptor: z.string().min(1).nullable().default(null),
  visualTargetId: z.string().min(1).nullable().default(null),
  targetType: VisualTargetTypeSchema.nullable().default(null),
  boundingBox: VisualBoundingBoxSchema.nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  geometryStatus: z.string().min(1).nullable().default(null),
  verificationResult: VisualActionVerificationResultSchema.nullable().default(null),
  result: StructuredLogStatusSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().default(null),
});

export const LiveProofLogSequence = [
  "open_target_page_completed",
  "detect_login_or_safety_completed",
  "wait_feed_ready_completed",
  "single_video_round_started",
  "wait_video_stable_completed",
  "identify_current_video_completed",
  "screenshot_video_area_completed",
  "branch_decision_completed",
  "scroll_next_video_completed",
  "next_video_wait_started",
] as const;

export const LiveProofLogSequenceSchema = z.array(StructuredRuntimeEventTypeSchema).superRefine((sequence, ctx) => {
  let cursor = 0;

  for (const eventType of sequence) {
    if (eventType === LiveProofLogSequence[cursor]) {
      cursor += 1;
      if (cursor === LiveProofLogSequence.length) {
        return;
      }
    }
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Live proof sequence is missing one or more required runtime proof events.",
  });
});

export type StructuredLogStatus = z.infer<typeof StructuredLogStatusSchema>;
export type StructuredRuntimeLogLevel = z.infer<typeof StructuredRuntimeLogLevelSchema>;
export type StructuredRuntimeEventType = z.infer<typeof StructuredRuntimeEventTypeSchema>;
export type StructuredActionType = z.infer<typeof StructuredActionTypeSchema>;
export type StructuredActionPurpose = z.infer<typeof StructuredActionPurposeSchema>;
export type StructuredLogRef = z.infer<typeof StructuredLogRefSchema>;
export type StructuredRuntimeMissingFrame = z.infer<typeof StructuredRuntimeMissingFrameSchema>;
export type StructuredAiImageInput = z.infer<typeof StructuredAiImageInputSchema>;
export type StructuredRuntimeSnapshotSummary = z.infer<typeof StructuredRuntimeSnapshotSummarySchema>;
export type StructuredRuntimeEvent = z.infer<typeof StructuredRuntimeEventSchema>;
export type StructuredActionLog = z.infer<typeof StructuredActionLogSchema>;
export type LiveProofLogSequence = typeof LiveProofLogSequence;