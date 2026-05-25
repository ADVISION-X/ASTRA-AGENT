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

const DeepResearchRankedConclusionStrengthSchema = z.enum([
  "strong",
  "moderate",
  "weak",
  "conditional",
]);

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
  strongestOpposingArguments: z.array(z.string().trim().min(1)).default([]),
}).strict();

export const DeepResearchFinalReportSchema = DeepResearchNormalizedFinalReportSchema;

const DeepResearchResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.literal("success"),
  jobStatus: z.literal("completed"),
  phase: DeepResearchPhaseSchema,
  report: DeepResearchFinalReportSchema,
  recordHashes: z.record(z.string(), z.string()),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

const DeepResearchTerminalResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.enum(["failed", "review_required"]),
  jobStatus: z.enum(["failed", "review_required"]),
  phase: DeepResearchPhaseSchema,
  report: DeepResearchFinalReportSchema.nullable(),
  recordHashes: z.record(z.string(), z.string()),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

export type DeepResearchSourceNote = z.infer<typeof DeepResearchSourceNoteSchema>;
export type DeepResearchFinalReport = z.infer<typeof DeepResearchFinalReportSchema>;
export type DeepResearchResult = z.infer<typeof DeepResearchResultSchema> | z.infer<typeof DeepResearchTerminalResultSchema>;
