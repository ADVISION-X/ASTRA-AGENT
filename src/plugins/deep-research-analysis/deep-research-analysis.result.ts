import { z } from "zod";

import {
  DeepResearchJobStatusSchema,
  DeepResearchPhaseSchema,
} from "./deep-research-analysis.schema.js";

const DeepResearchReportConfidenceSchema = z.enum([
  "low",
  "medium",
  "high",
]);

const DeepResearchConflictLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

const DeepResearchRankedConclusionStrengthSchema = z.enum([
  "strong",
  "moderate",
  "weak",
  "conditional",
]);

export const DeepResearchConflictMatrixRowSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  positiveClaimSummary: z.string().trim().min(1),
  falsificationSummary: z.string().trim().min(1),
  conflictLevel: DeepResearchConflictLevelSchema,
  evidenceGap: z.string().trim().min(1),
  needsHumanReview: z.boolean(),
}).strict();

const DeepResearchRankedConclusionSchema = z.object({
  rank: z.number().int().positive(),
  conclusion: z.string().trim().min(1),
  whyItMatters: z.string().trim().min(1),
  strength: DeepResearchRankedConclusionStrengthSchema,
  appliesTo: z.array(z.string().trim().min(1)).default([]),
  doesNotApplyTo: z.array(z.string().trim().min(1)).default([]),
  reverseCondition: z.string().trim().default(""),
}).strict();

export const DeepResearchSourceNoteSchema = z.object({
  sourceNoteId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  note: z.string().trim().min(1),
  sourceType: z.enum(["analysis_evidence_mention", "final_reference", "unstructured_reference"]),
  subQuestionIds: z.array(z.string().trim().min(1)).default([]),
  url: z.string().trim().min(1).nullable().default(null),
}).strict();

const DeepResearchNormalizedFinalReportSchema = z.object({
  directAnswer: z.string().trim().min(1),
  finalVerdict: z.string().trim().min(1),
  oneSentenceDecision: z.string().trim().min(1).optional(),
  confidence: DeepResearchReportConfidenceSchema,
  rankedConclusions: z.array(DeepResearchRankedConclusionSchema).default([]),
  strongConclusions: z.array(z.string().trim().min(1)).default([]),
  conditionalConclusions: z.array(z.string().trim().min(1)).default([]),
  weakOrRejectedClaims: z.array(z.string().trim().min(1)).default([]),
  decisiveReasons: z.array(z.string().trim().min(1)).default([]),
  evidenceGaps: z.array(z.string().trim().min(1)).default([]),
  reverseConditions: z.array(z.string().trim().min(1)).default([]),
  applicability: z.array(z.string().trim().min(1)).default([]),
  nonApplicability: z.array(z.string().trim().min(1)).default([]),
  followUpSignals: z.array(z.string().trim().min(1)).default([]),
  multiStageValueAdded: z.array(z.string().trim().min(1)).default([]),
  limitations: z.array(z.string().trim().min(1)).default([]),
  references: z.array(z.string().trim().min(1)).default([]),
  sourceNotes: z.array(DeepResearchSourceNoteSchema).default([]),
  executiveConclusion: z.string().trim().min(1),
  positiveReasons: z.array(z.string().trim().min(1)).default([]),
  strongestOpposingArguments: z.array(z.string().trim().min(1)).default([]),
  conflictMatrix: z.array(DeepResearchConflictMatrixRowSchema).default([]),
}).strict();

const DeepResearchLegacyFinalReportSchema = z.object({
  executiveConclusion: z.string().trim().min(1),
  confidence: DeepResearchReportConfidenceSchema,
  positiveReasons: z.array(z.string().trim().min(1)).default([]),
  strongestOpposingArguments: z.array(z.string().trim().min(1)).default([]),
  conflictMatrix: z.array(DeepResearchConflictMatrixRowSchema).default([]),
  evidenceGaps: z.array(z.string().trim().min(1)).default([]),
  reverseConditions: z.array(z.string().trim().min(1)).default([]),
  followUpSignals: z.array(z.string().trim().min(1)).default([]),
  limitations: z.array(z.string().trim().min(1)).default([]),
  references: z.array(z.string().trim().min(1)).default([]),
  sourceNotes: z.array(DeepResearchSourceNoteSchema).default([]),
}).strict();

const DeepResearchModernFinalReportSchema = z.object({
  directAnswer: z.string().trim().min(1),
  finalVerdict: z.string().trim().min(1),
  oneSentenceDecision: z.string().trim().min(1).optional(),
  confidence: DeepResearchReportConfidenceSchema,
  rankedConclusions: z.array(DeepResearchRankedConclusionSchema).default([]),
  strongConclusions: z.array(z.string().trim().min(1)).default([]),
  conditionalConclusions: z.array(z.string().trim().min(1)).default([]),
  weakOrRejectedClaims: z.array(z.string().trim().min(1)).default([]),
  decisiveReasons: z.array(z.string().trim().min(1)).default([]),
  evidenceGaps: z.array(z.string().trim().min(1)).default([]),
  reverseConditions: z.array(z.string().trim().min(1)).default([]),
  applicability: z.array(z.string().trim().min(1)).default([]),
  nonApplicability: z.array(z.string().trim().min(1)).default([]),
  followUpSignals: z.array(z.string().trim().min(1)).default([]),
  multiStageValueAdded: z.array(z.string().trim().min(1)).default([]),
  limitations: z.array(z.string().trim().min(1)).default([]),
  references: z.array(z.string().trim().min(1)).default([]),
  sourceNotes: z.array(DeepResearchSourceNoteSchema).default([]),
}).strict();

const buildLegacyVerdictLabel = (value: string): string =>
  value.replace(/\s+/gu, " ").trim().slice(0, 80) || "legacy_report";

const normalizeLegacyFinalReport = (
  report: z.infer<typeof DeepResearchLegacyFinalReportSchema>,
) =>
  DeepResearchNormalizedFinalReportSchema.parse({
    directAnswer: report.executiveConclusion,
    finalVerdict: buildLegacyVerdictLabel(report.executiveConclusion),
    oneSentenceDecision: report.executiveConclusion,
    confidence: report.confidence,
    rankedConclusions: [],
    strongConclusions: report.positiveReasons,
    conditionalConclusions: [],
    weakOrRejectedClaims: report.strongestOpposingArguments,
    decisiveReasons: report.positiveReasons,
    evidenceGaps: report.evidenceGaps,
    reverseConditions: report.reverseConditions,
    applicability: [],
    nonApplicability: [],
    followUpSignals: report.followUpSignals,
    multiStageValueAdded: [],
    limitations: report.limitations,
    references: report.references,
    sourceNotes: report.sourceNotes,
    executiveConclusion: report.executiveConclusion,
    positiveReasons: report.positiveReasons,
    strongestOpposingArguments: report.strongestOpposingArguments,
    conflictMatrix: report.conflictMatrix,
  });

const normalizeModernFinalReport = (
  report: z.infer<typeof DeepResearchModernFinalReportSchema>,
) =>
  DeepResearchNormalizedFinalReportSchema.parse({
    ...report,
    oneSentenceDecision: report.oneSentenceDecision ?? report.directAnswer,
    executiveConclusion: report.directAnswer,
    positiveReasons: report.decisiveReasons,
    strongestOpposingArguments: report.weakOrRejectedClaims,
    conflictMatrix: [],
  });

export const DeepResearchFinalReportSchema = z.union([
  DeepResearchNormalizedFinalReportSchema,
  DeepResearchModernFinalReportSchema.transform(normalizeModernFinalReport),
  DeepResearchLegacyFinalReportSchema.transform(normalizeLegacyFinalReport),
]);

const DeepResearchResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.literal("success"),
  jobStatus: z.enum(["completed", "deck_export_partial"]),
  phase: DeepResearchPhaseSchema,
  report: DeepResearchFinalReportSchema,
  recordHashes: z.record(z.string(), z.string()),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

const DeepResearchTerminalResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.enum(["failed", "review_required"]),
  jobStatus: z.enum(["failed", "review_required", "deck_export_partial"]),
  phase: DeepResearchPhaseSchema,
  report: DeepResearchFinalReportSchema.nullable(),
  recordHashes: z.record(z.string(), z.string()),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

export type DeepResearchConflictMatrixRow = z.infer<typeof DeepResearchConflictMatrixRowSchema>;
export type DeepResearchSourceNote = z.infer<typeof DeepResearchSourceNoteSchema>;
export type DeepResearchFinalReport = z.infer<typeof DeepResearchFinalReportSchema>;
export type DeepResearchResult = z.infer<typeof DeepResearchResultSchema> | z.infer<typeof DeepResearchTerminalResultSchema>;
