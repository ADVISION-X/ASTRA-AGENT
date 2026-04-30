import { z } from "zod";

import {
  CommanderCommandTypeSchema,
  CommanderMissionStatusSchema,
  CommanderRecordTypeSchema,
  CommanderReviewStatusSchema,
  NonEmptyStringSchema,
  RequestedPlatformIdSchema,
} from "./commander-schema-foundation.js";

const CommanderMissionViewSchema = z.object({
  missionId: NonEmptyStringSchema.nullable(),
  humanGoal: z.string(),
  status: CommanderMissionStatusSchema,
  missionRunRef: NonEmptyStringSchema.nullable(),
  currentRoundIndex: z.number().int().min(0),
  requestedPlatform: RequestedPlatformIdSchema.nullable(),
  selectedMapId: NonEmptyStringSchema.nullable(),
  lastHumanCommand: CommanderCommandTypeSchema.nullable(),
  reviewRequiredReason: z.string().nullable(),
  failureReason: z.string().nullable(),
  startedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
}).strict();

const CommanderRuntimeSummaryViewSchema = z.object({
  runtimeStatus: CommanderMissionStatusSchema,
  currentStep: z.string().nullable(),
  reviewReason: z.string().nullable(),
  totalSeenCount: z.number().int().min(0),
  evidencePacketCount: z.number().int().min(0),
  browseLedgerCount: z.number().int().min(0),
  candidateCount: z.number().int().min(0),
  lastAiFailureReason: z.string().nullable(),
}).strict();

const CommanderBrowserSummaryViewSchema = z.object({
  browserMode: NonEmptyStringSchema,
  browserExecutable: z.string().nullable(),
  browserProfileRef: NonEmptyStringSchema,
  browserProfileStatus: NonEmptyStringSchema,
  loginState: NonEmptyStringSchema,
  executionMode: NonEmptyStringSchema,
  geometryGuard: NonEmptyStringSchema,
  viewport: NonEmptyStringSchema,
  calibration: NonEmptyStringSchema,
}).strict();

const CommanderCapabilityHealthEntrySchema = z.object({
  id: NonEmptyStringSchema,
  label: NonEmptyStringSchema,
  tone: z.enum(["normal", "good", "warn", "danger", "muted"]),
  detail: NonEmptyStringSchema,
  ownerResponsible: NonEmptyStringSchema.nullable().optional(),
  actionableMessage: NonEmptyStringSchema.nullable().optional(),
}).strict();

const CommanderCapabilityRosterEntrySchema = z.object({
  abilityGroupId: NonEmptyStringSchema,
  displayName: NonEmptyStringSchema,
  currentStrength: NonEmptyStringSchema,
  purpose: NonEmptyStringSchema,
}).strict();

const CommanderCandidateViewSchema = z.object({
  id: NonEmptyStringSchema,
  category: NonEmptyStringSchema,
  useCase: NonEmptyStringSchema,
  score: z.number(),
  purchaseIntent: NonEmptyStringSchema,
  reviewStatus: CommanderReviewStatusSchema,
  evidenceCount: z.number().int().min(0),
  notes: z.array(z.string()),
  createdAt: NonEmptyStringSchema,
  updatedAt: NonEmptyStringSchema,
}).strict();

const CommanderRecordSummaryViewSchema = z.object({
  id: NonEmptyStringSchema,
  primary: NonEmptyStringSchema,
  secondary: NonEmptyStringSchema,
  detail: NonEmptyStringSchema,
}).strict();

const CommanderRuntimeProofTimelineEntrySchema = z.object({
  id: NonEmptyStringSchema,
  createdAt: NonEmptyStringSchema,
  step: NonEmptyStringSchema,
  status: NonEmptyStringSchema,
  message: NonEmptyStringSchema,
}).strict();

const CommanderAuditSummarySchema = z.object({
  phase: NonEmptyStringSchema,
  activeCapabilityDomains: z.array(NonEmptyStringSchema),
  lastGeneratedAt: z.string().nullable(),
  lastRunGeneratedAt: z.string().nullable(),
  totals: z.object({
    inspectors: z.number().int().min(0),
    passed: z.number().int().min(0),
    failed: z.number().int().min(0),
    blocking: z.number().int().min(0),
  }).nullable(),
}).strict();

const CommanderRecordDetailViewSchema = z.object({
  recordType: CommanderRecordTypeSchema,
  recordId: NonEmptyStringSchema.nullable(),
  title: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  details: z.array(z.string()),
  status: z.string().nullable(),
  createdAt: z.string().nullable(),
}).strict();

const CommanderMissionDashboardViewSchema = z.object({
  mission: CommanderMissionViewSchema,
  runtime: CommanderRuntimeSummaryViewSchema,
  browser: CommanderBrowserSummaryViewSchema,
  health: z.array(CommanderCapabilityHealthEntrySchema),
  capabilityRoster: z.array(CommanderCapabilityRosterEntrySchema),
  candidates: z.array(CommanderCandidateViewSchema),
  reviewQueue: z.array(CommanderRecordSummaryViewSchema),
  evidencePackets: z.array(CommanderRecordSummaryViewSchema),
  browseLedger: z.array(CommanderRecordSummaryViewSchema),
  failedRecords: z.array(CommanderRecordSummaryViewSchema),
  runtimeProof: z.array(CommanderRuntimeProofTimelineEntrySchema),
  auditSummary: CommanderAuditSummarySchema,
}).strict();

export {
  CommanderAuditSummarySchema,
  CommanderBrowserSummaryViewSchema,
  CommanderCandidateViewSchema,
  CommanderCapabilityHealthEntrySchema,
  CommanderCapabilityRosterEntrySchema,
  CommanderMissionDashboardViewSchema,
  CommanderMissionViewSchema,
  CommanderRecordDetailViewSchema,
  CommanderRecordSummaryViewSchema,
  CommanderRuntimeProofTimelineEntrySchema,
  CommanderRuntimeSummaryViewSchema,
};