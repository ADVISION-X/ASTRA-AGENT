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

export const DeepResearchSourceNoteSchema = z.object({
  sourceNoteId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  note: z.string().trim().min(1),
  sourceType: z.enum(["analysis_evidence_mention", "final_reference", "unstructured_reference"]),
  subQuestionIds: z.array(z.string().trim().min(1)).default([]),
  url: z.string().trim().min(1).nullable().default(null),
}).strict();

const DeepResearchNormalizedFinalReportSchema = z.object({
  summary: z.string().trim().min(1),
  confidence: DeepResearchReportConfidenceSchema,
  structuredPayload: z.record(z.string(), z.unknown()),
  references: z.array(z.string().trim().min(1)).default([]),
  sourceNotes: z.array(DeepResearchSourceNoteSchema).default([]),
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
