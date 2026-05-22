import { z } from "zod";

import {
  DeepResearchJobStatusSchema,
  DeepResearchPhaseSchema,
} from "./deep-research-analysis.schema.js";

export const DeepResearchResultStatusSchema = z.enum([
  "success",
  "failed",
  "review_required",
]);

export const DeepResearchReportConfidenceSchema = z.enum([
  "low",
  "medium",
  "high",
]);

export const DeepResearchConflictLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const DeepResearchConflictMatrixRowSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  positiveClaimSummary: z.string().trim().min(1),
  falsificationSummary: z.string().trim().min(1),
  conflictLevel: DeepResearchConflictLevelSchema,
  evidenceGap: z.string().trim().min(1),
  needsHumanReview: z.boolean(),
}).strict();

export const DeepResearchFinalReportSchema = z.object({
  executiveConclusion: z.string().trim().min(1),
  confidence: DeepResearchReportConfidenceSchema,
  positiveReasons: z.array(z.string().trim().min(1)).min(1),
  strongestOpposingArguments: z.array(z.string().trim().min(1)).min(1),
  conflictMatrix: z.array(DeepResearchConflictMatrixRowSchema).min(1),
  evidenceGaps: z.array(z.string().trim().min(1)).min(1),
  reverseConditions: z.array(z.string().trim().min(1)).min(1),
  followUpSignals: z.array(z.string().trim().min(1)).min(1),
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

export const DeepResearchResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: DeepResearchResultStatusSchema,
  jobStatus: DeepResearchJobStatusSchema,
  phase: DeepResearchPhaseSchema,
  report: DeepResearchFinalReportSchema.nullable().default(null),
  recordHashes: z.record(z.string(), z.string()).default({}),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

export type DeepResearchResultStatus = z.infer<typeof DeepResearchResultStatusSchema>;
export type DeepResearchConflictLevel = z.infer<typeof DeepResearchConflictLevelSchema>;
export type DeepResearchConflictMatrixRow = z.infer<typeof DeepResearchConflictMatrixRowSchema>;
export type DeepResearchFinalReport = z.infer<typeof DeepResearchFinalReportSchema>;
export type DeepResearchResult = z.infer<typeof DeepResearchResultSchema>;

export const DeepResearchResultSchemas = {
  DeepResearchResultStatusSchema,
  DeepResearchReportConfidenceSchema,
  DeepResearchConflictLevelSchema,
  DeepResearchConflictMatrixRowSchema,
  DeepResearchFinalReportSchema,
  DeepResearchResultSchema,
} as const;