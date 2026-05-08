import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";
import {
  BrowseLedgerOutcomeSchema,
  BrowseLedgerProductPresenceDecisionSchema,
  BrowseSummarySchema,
  EvidencePacketActionPurposeSchema,
  EvidencePacketActionTriggerSourceSchema,
  EvidencePacketCandidateRefSchema,
  EvidencePacketCommentEvidenceSchema,
  EvidencePacketAdvancedAIAnalysisPlaceholderSchema,
  EvidencePacketDataQualityFlagSchema,
  EvidencePacketPageStateSchema,
  EvidencePacketPreActionMetricsSchema,
  EvidencePacketProductPresenceAISchema,
  EvidencePacketRoundOutcomeSchema,
  EvidencePacketVideoEvidenceSchema,
} from "./evidence-packet.js";
import { MultiFrameSamplingStrategySchema } from "./multi-frame-evidence.js";
import { StructuredRuntimeEventTypeSchema } from "./structured-log.js";

const LocalDatabaseTableNameSchema = z.enum([
  "browse_sessions",
  "video_rounds",
  "structured_runtime_events",
  "structured_action_logs",
  "evidence_records",
  "multi_frame_evidence_sets",
  "ai_results",
  "browse_ledger_entries",
  "evidence_packets",
  "product_candidates",
  "export_sets",
]);

const LocalPersistencePathLayoutSchema = z.object({
  rootDir: z.literal(".grasseye-local"),
  dataDir: z.literal(".grasseye-local/data"),
  databaseFile: z.literal(".grasseye-local/data/grasseye.sqlite"),
  evidenceDir: z.literal(".grasseye-local/evidence"),
  videoFramesDir: z.literal(".grasseye-local/evidence/video-frames"),
  contactSheetsDir: z.literal(".grasseye-local/evidence/contact-sheets"),
  commentScreenshotsDir: z.literal(".grasseye-local/evidence/comment-screenshots"),
  ocrTextDir: z.literal(".grasseye-local/evidence/ocr-text"),
  exportsDir: z.literal(".grasseye-local/exports"),
  advancedAiExportsDir: z.literal(".grasseye-local/exports/advanced-ai"),
  browserProfilesDir: z.literal(".grasseye-local/browser-profiles"),
  runtimeLogsDir: z.literal(".grasseye-local/logs/runtime"),
});

const LocalPersistenceRootSchema = z.object({
  pathLayout: LocalPersistencePathLayoutSchema,
  structuredStoreKind: z.literal("sqlite"),
  evidenceStoreKind: z.literal("file_store"),
  exportStoreKind: z.literal("file_store"),
  browserProfileStoreKind: z.literal("browser_profile_store"),
});

const BrowseSessionRecordSchema = z.object({
  sessionId: z.string().min(1),
  platform: z.string().min(1),
  targetUrl: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().default(null),
  status: z.string().min(1),
  totalSeenCount: z.number().int().nonnegative(),
  productYesCount: z.number().int().nonnegative(),
  productNoCount: z.number().int().nonnegative(),
  uncertainCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  evidencePacketCount: z.number().int().nonnegative(),
  browseLedgerCount: z.number().int().nonnegative(),
  exportPacketCount: z.number().int().nonnegative(),
  stopReason: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const VideoRoundFinalizationTypeSchema = z.enum(["evidence_packet", "browse_ledger", "failed_record"]);

const VideoRoundRecordSchema = z.object({
  roundId: z.string().min(1),
  sessionId: z.string().min(1),
  videoVisitId: z.string().min(1),
  sourcePlatform: z.string().min(1),
  sourceUrl: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().default(null),
  roundOutcome: EvidencePacketRoundOutcomeSchema,
  productPresenceDecision: BrowseLedgerProductPresenceDecisionSchema,
  confidence: z.number().min(0).max(1).nullable().default(null),
  nextStep: z.string().min(1),
  finalizationType: VideoRoundFinalizationTypeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const StructuredRuntimeEventRecordSchema = z.object({
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  eventType: StructuredRuntimeEventTypeSchema,
  step: z.string().min(1),
  previousStep: z.string().min(1).nullable().default(null),
  nextStep: z.string().min(1).nullable().default(null),
  status: z.string().min(1),
  reason: z.string().min(1).nullable().default(null),
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  inputRefs: z.array(z.string().min(1)).default([]),
  outputRefs: z.array(z.string().min(1)).default([]),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  actionLogRefs: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().default(null),
});

const StructuredActionLogRecordSchema = z.object({
  actionLogId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  step: z.string().min(1),
  actionType: z.string().min(1),
  actionPurpose: EvidencePacketActionPurposeSchema,
  triggerSource: EvidencePacketActionTriggerSourceSchema,
  targetType: z.string().min(1).nullable().default(null),
  visualTargetId: z.string().min(1).nullable().default(null),
  beforeEvidenceId: z.string().min(1).nullable().default(null),
  afterEvidenceId: z.string().min(1).nullable().default(null),
  result: z.enum(["success", "skipped", "failed", "review_required"]),
  failureReason: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().default(null),
});

const EvidenceRecordTypeSchema = z.enum(["video_frame", "contact_sheet", "comment_screenshot", "ocr_text", "ai_result"]);

const EvidenceRecordSchema = z.object({
  evidenceId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  evidenceType: EvidenceRecordTypeSchema,
  regionType: z.string().min(1),
  storageRef: z.string().min(1),
  screenshotHash: z.string().min(1).nullable().default(null),
  width: z.number().int().nonnegative().nullable().default(null),
  height: z.number().int().nonnegative().nullable().default(null),
  capturedAt: z.string().datetime(),
  sourceUrl: z.string().min(1),
  dataQualityFlags: z.array(EvidencePacketDataQualityFlagSchema).default([]),
  createdAt: z.string().datetime(),
});

const MultiFrameEvidenceSetRecordSchema = z.object({
  multiFrameEvidenceSetId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  samplingStrategy: MultiFrameSamplingStrategySchema,
  frameEvidenceIds: z.array(z.string().min(1)).default([]),
  contactSheetEvidenceId: z.string().min(1).nullable().default(null),
  validFrameCount: z.number().int().nonnegative(),
  dataQualityFlags: z.array(EvidencePacketDataQualityFlagSchema).default([]),
  createdAt: z.string().datetime(),
});

const AIResultRecordSchema = z.object({
  aiResultId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  taskType: z.string().min(1),
  promptId: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  modelRole: z.string().min(1),
  modelNameOrToolName: z.string().min(1),
  inputEvidenceRefs: z.array(EvidenceRefSchema).default([]),
  outputJson: z.unknown(),
  confidence: z.number().min(0).max(1).nullable().default(null),
  uncertainty: z.array(z.string().min(1)).default([]),
  mustReview: z.boolean(),
  createdAt: z.string().datetime(),
});

const BrowseLedgerEntryRecordSchema = z.object({
  ledgerEntryId: z.string().min(1),
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
  createdAt: z.string().datetime(),
});

const EvidencePacketRecordSchema = z.object({
  packetId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  sourcePlatform: z.string().min(1),
  sourceUrl: z.string().min(1),
  capturedAt: z.string().datetime(),
  roundOutcome: EvidencePacketRoundOutcomeSchema,
  nextStep: z.string().min(1),
  pageStateJson: EvidencePacketPageStateSchema,
  videoEvidenceJson: EvidencePacketVideoEvidenceSchema,
  productPresenceAIJson: EvidencePacketProductPresenceAISchema,
  preActionMetricsJson: EvidencePacketPreActionMetricsSchema,
  actionsJson: z.array(StructuredActionLogRecordSchema).default([]),
  commentEvidenceJson: EvidencePacketCommentEvidenceSchema,
  advancedAIAnalysisPlaceholderJson: EvidencePacketAdvancedAIAnalysisPlaceholderSchema,
  candidateJson: EvidencePacketCandidateRefSchema,
  dataQualityFlagsJson: z.array(EvidencePacketDataQualityFlagSchema).default([]),
  exportForAdvancedAIJson: z.object({
    included: z.boolean(),
    exportVersion: z.string().min(1),
    allowedUse: z.array(z.string().min(1)).default([]),
    forbiddenUse: z.array(z.string().min(1)).default([]),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ProductCandidateRecordSchema = z.object({
  candidateId: z.string().min(1),
  packetId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  status: z.literal("pending_analysis"),
  candidateType: z.enum(["video_only", "richer_candidate"]),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ExportSetRecordSchema = z.object({
  exportId: z.string().min(1),
  sessionId: z.string().min(1),
  exportVersion: z.string().min(1),
  packetIds: z.array(z.string().min(1)).default([]),
  packetCount: z.number().int().nonnegative(),
  browseSummaryJson: BrowseSummarySchema,
  excludedBrowseLedgerByDefault: z.literal(true),
  createdAt: z.string().datetime(),
  storageRef: z.string().min(1),
});

const LocalPersistenceRelationshipRuleSchema = z.object({
  fromTable: LocalDatabaseTableNameSchema,
  toTable: LocalDatabaseTableNameSchema,
  cardinality: z.enum(["one_to_many", "one_to_one", "zero_or_one_to_one"]),
  via: z.string().min(1),
  note: z.string().min(1),
});

const LocalPersistenceRelationshipMapSchema = z.object({
  sessionToVideoRounds: LocalPersistenceRelationshipRuleSchema,
  videoRoundToRuntimeEvents: LocalPersistenceRelationshipRuleSchema,
  videoRoundToActionLogs: LocalPersistenceRelationshipRuleSchema,
  videoRoundToEvidenceRecords: LocalPersistenceRelationshipRuleSchema,
  productYesRoundToEvidencePacket: LocalPersistenceRelationshipRuleSchema,
  productNoRoundToBrowseLedgerEntry: LocalPersistenceRelationshipRuleSchema,
  evidencePacketToProductCandidate: LocalPersistenceRelationshipRuleSchema,
  exportSetToEvidencePackets: LocalPersistenceRelationshipRuleSchema,
  browserProfileToRuntime: z.object({
    via: z.literal("browserProfileRef"),
    note: z.literal("browser profiles stay separate from evidence storage and packets"),
  }),
});

type LocalDatabaseTableName = z.infer<typeof LocalDatabaseTableNameSchema>;
type LocalPersistencePathLayout = z.infer<typeof LocalPersistencePathLayoutSchema>;
type LocalPersistenceRoot = z.infer<typeof LocalPersistenceRootSchema>;
type BrowseSessionRecord = z.infer<typeof BrowseSessionRecordSchema>;
type VideoRoundRecord = z.infer<typeof VideoRoundRecordSchema>;
type StructuredRuntimeEventRecord = z.infer<typeof StructuredRuntimeEventRecordSchema>;
type StructuredActionLogRecord = z.infer<typeof StructuredActionLogRecordSchema>;
type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
type MultiFrameEvidenceSetRecord = z.infer<typeof MultiFrameEvidenceSetRecordSchema>;
type AIResultRecord = z.infer<typeof AIResultRecordSchema>;
type BrowseLedgerEntryRecord = z.infer<typeof BrowseLedgerEntryRecordSchema>;
type EvidencePacketRecord = z.infer<typeof EvidencePacketRecordSchema>;
type ProductCandidateRecord = z.infer<typeof ProductCandidateRecordSchema>;
type ExportSetRecord = z.infer<typeof ExportSetRecordSchema>;
type LocalPersistenceRelationshipMap = z.infer<typeof LocalPersistenceRelationshipMapSchema>;

export { LocalDatabaseTableNameSchema, LocalPersistencePathLayoutSchema, LocalPersistenceRootSchema, BrowseSessionRecordSchema, VideoRoundFinalizationTypeSchema, VideoRoundRecordSchema, StructuredRuntimeEventRecordSchema, StructuredActionLogRecordSchema, EvidenceRecordTypeSchema, EvidenceRecordSchema, MultiFrameEvidenceSetRecordSchema, AIResultRecordSchema, BrowseLedgerEntryRecordSchema, EvidencePacketRecordSchema, ProductCandidateRecordSchema, ExportSetRecordSchema, LocalPersistenceRelationshipMapSchema };
export type { LocalDatabaseTableName, LocalPersistencePathLayout, LocalPersistenceRoot, BrowseSessionRecord, VideoRoundRecord, StructuredRuntimeEventRecord, StructuredActionLogRecord, EvidenceRecord, MultiFrameEvidenceSetRecord, AIResultRecord, BrowseLedgerEntryRecord, EvidencePacketRecord, ProductCandidateRecord, ExportSetRecord, LocalPersistenceRelationshipMap };
