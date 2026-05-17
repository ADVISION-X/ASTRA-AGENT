import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";

const nullableString = z.string().min(1).nullable().default(null);

const StructuredRuntimeLogLevelSchema = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]);
const StructuredLogStatusSchema = z.enum(["started", "success", "failed", "skipped", "review_required"]);
const StructuredRuntimeEventTypeSchema = z.string().min(1);
const StructuredActionTypeSchema = z.string().min(1);
const StructuredActionPurposeSchema = z.enum(["observe", "open", "click", "scroll", "type", "save", "stop"]);

const StructuredLogRefSchema = z.object({
  refId: z.string().min(1),
  refType: z.enum(["evidence", "action_log", "ai_result", "ledger", "snapshot", "other"]),
  label: nullableString,
});

const StructuredRuntimeMissingFrameSchema = z.never();

const StructuredAiImageInputSchema = z.object({
  refId: nullableString,
  artifactRef: nullableString,
  filePath: nullableString,
  hash: nullableString,
  bytes: z.number().int().nonnegative().nullable().default(null),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
});

const StructuredRuntimeResourceProcessSchema = z.object({
  pid: z.number().int().positive(),
  rssMb: z.number().nonnegative(),
  cpuPercent: z.number().nonnegative(),
  tags: z.array(z.string().min(1)).default([]),
}).strict();

const StructuredRuntimeResourceSummarySchema = z.object({
  capturedAt: z.string().datetime(),
  chromeRssMb: z.number().nonnegative(),
  chromeProcessCount: z.number().int().nonnegative(),
  nodeRssMb: z.number().nonnegative(),
  hostFreeMemoryMb: z.number().nonnegative(),
  warningThresholdMb: z.number().positive().nullable().default(null),
  topChromePid: z.number().int().positive().nullable().default(null),
  topChromeRssMb: z.number().nonnegative().nullable().default(null),
  interestingProcesses: z.array(StructuredRuntimeResourceProcessSchema).default([]),
}).strict();

const StructuredRuntimeSnapshotSummarySchema = z.object({
  runtimeStatus: z.string().min(1),
  currentStep: z.string().min(1),
  latestRoundOutcome: nullableString,
  reviewRequiredReason: nullableString,
  counters: z.record(z.string(), z.number().int().nonnegative()).default({}),
});

const StructuredJointStageSchema = z.enum(["none", "ai", "geometry_guard", "capability"]);
const StructuredJointCheckpointStatusSchema = z.enum(["exists", "missing", "not_applicable"]);

const StructuredFailureSnapshotSchema = z.object({
  failedStepId: nullableString,
  failureReason: nullableString,
  lastSuccessfulStepId: nullableString,
  screenshotEvidenceRef: nullableString,
  aiResultRef: nullableString,
  geometryGuardResultRef: nullableString,
  capabilityResultRef: nullableString,
}).strict();

const StructuredJointCheckpointSchema = z.object({
  aiResult: StructuredJointCheckpointStatusSchema.default("not_applicable"),
  geometryGuardResult: StructuredJointCheckpointStatusSchema.default("not_applicable"),
  capabilityResult: StructuredJointCheckpointStatusSchema.default("not_applicable"),
}).strict();

const StructuredRuntimeEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: StructuredRuntimeEventTypeSchema,
  level: StructuredRuntimeLogLevelSchema.default("INFO"),
  phase: nullableString,
  component: nullableString,
  owner: nullableString,
  abilityGroupId: z.string().min(1).default("orchestration"),
  targetAbilityGroupId: nullableString,
  childCapabilityId: nullableString,
  sessionId: z.string().min(1),
  runId: nullableString,
  missionId: nullableString,
  roundId: nullableString,
  stepId: nullableString,
  traceId: nullableString,
  spanId: nullableString,
  capabilityCallId: nullableString,
  status: StructuredLogStatusSchema,
  reason: nullableString,
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
  actionableMessage: nullableString,
  ownerResponsible: nullableString,
  decision: nullableString,
  snapshotSummary: StructuredRuntimeSnapshotSummarySchema.nullable().default(null),
  resourceSummary: StructuredRuntimeResourceSummarySchema.nullable().default(null),
  provider: nullableString,
  model: nullableString,
  modelRole: nullableString,
  promptContractId: nullableString,
  outputSchemaRef: nullableString,
  promptDebugRef: nullableString,
  rawResponseRef: nullableString,
  parsedJson: z.unknown().nullable().default(null),
  parserErrors: z.array(z.string().min(1)).default([]),
  screenshotEvidenceId: nullableString,
  artifactRef: nullableString,
  artifactStorageRef: nullableString,
  byteSize: z.number().int().nonnegative().nullable().default(null),
  width: z.number().positive().nullable().default(null),
  height: z.number().positive().nullable().default(null),
  coordinateSpace: nullableString,
  runtimeProofRef: nullableString,
  imageInputs: z.array(StructuredAiImageInputSchema).default([]),
  startedAt: nullableString,
  endedAt: nullableString,
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().default(null),
  jointStage: StructuredJointStageSchema.default("none"),
  failureSnapshot: StructuredFailureSnapshotSchema.nullable().default(null),
  jointCheckpoint: StructuredJointCheckpointSchema.nullable().default(null),
  refs: z.array(z.string().min(1)).default([]),
  inputRefs: z.array(EvidenceRefSchema).default([]),
  outputRefs: z.array(EvidenceRefSchema).default([]),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  proofRefs: z.array(z.string().min(1)).default([]),
  artifactRefs: z.array(z.string().min(1)).default([]),
}).passthrough();

const RuntimeActionEventSchema = z.object({
  actionLogId: z.string().min(1),
  abilityGroupId: z.string().min(1).default("orchestration"),
  childCapabilityId: nullableString,
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  actionType: StructuredActionTypeSchema,
  actionPurpose: StructuredActionPurposeSchema,
  inputRefs: z.array(EvidenceRefSchema).default([]),
  outputRefs: z.array(EvidenceRefSchema).default([]),
  result: StructuredLogStatusSchema,
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().default(null),
}).passthrough();

const LiveProofLogSequence = [
  "ROUND_STARTED",
  "SCREENSHOT_CAPTURED",
  "COORDINATE_GRID_RENDERED",
  "AI_DECISION_SUMMARY",
  "CAPABILITY_DISPATCH_COMPLETED",
] as const;

const LiveProofLogSequenceSchema = z.array(StructuredRuntimeEventTypeSchema);

type StructuredLogStatus = z.infer<typeof StructuredLogStatusSchema>;
type StructuredRuntimeLogLevel = z.infer<typeof StructuredRuntimeLogLevelSchema>;
type StructuredRuntimeEventType = z.infer<typeof StructuredRuntimeEventTypeSchema>;
type StructuredActionType = z.infer<typeof StructuredActionTypeSchema>;
type StructuredActionPurpose = z.infer<typeof StructuredActionPurposeSchema>;
type StructuredLogRef = z.infer<typeof StructuredLogRefSchema>;
type StructuredRuntimeMissingFrame = z.infer<typeof StructuredRuntimeMissingFrameSchema>;
type StructuredAiImageInput = z.infer<typeof StructuredAiImageInputSchema>;
type StructuredRuntimeSnapshotSummary = z.infer<typeof StructuredRuntimeSnapshotSummarySchema>;
type StructuredRuntimeResourceSummary = z.infer<typeof StructuredRuntimeResourceSummarySchema>;
type StructuredJointStage = z.infer<typeof StructuredJointStageSchema>;
type StructuredJointCheckpointStatus = z.infer<typeof StructuredJointCheckpointStatusSchema>;
type StructuredFailureSnapshot = z.infer<typeof StructuredFailureSnapshotSchema>;
type StructuredJointCheckpoint = z.infer<typeof StructuredJointCheckpointSchema>;
type StructuredRuntimeEvent = z.infer<typeof StructuredRuntimeEventSchema>;
type RuntimeActionEvent = z.infer<typeof RuntimeActionEventSchema>;

export { StructuredRuntimeLogLevelSchema, StructuredLogStatusSchema, StructuredRuntimeEventTypeSchema, StructuredActionTypeSchema, StructuredActionPurposeSchema, StructuredLogRefSchema, StructuredRuntimeMissingFrameSchema, StructuredAiImageInputSchema, StructuredRuntimeResourceSummarySchema, StructuredRuntimeSnapshotSummarySchema, StructuredJointStageSchema, StructuredJointCheckpointStatusSchema, StructuredFailureSnapshotSchema, StructuredJointCheckpointSchema, StructuredRuntimeEventSchema, RuntimeActionEventSchema, LiveProofLogSequence, LiveProofLogSequenceSchema };
export type { StructuredLogStatus, StructuredRuntimeLogLevel, StructuredRuntimeEventType, StructuredActionType, StructuredActionPurpose, StructuredLogRef, StructuredRuntimeMissingFrame, StructuredAiImageInput, StructuredRuntimeResourceSummary, StructuredRuntimeSnapshotSummary, StructuredJointStage, StructuredJointCheckpointStatus, StructuredFailureSnapshot, StructuredJointCheckpoint, StructuredRuntimeEvent, RuntimeActionEvent };
