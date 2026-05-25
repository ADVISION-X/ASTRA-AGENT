import { z } from "zod";

import { DeepResearchPhaseSchema } from "./deep-research-analysis.schema.js";

export const DeepResearchSourceNoteSchema = z.object({
  sourceNoteId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  note: z.string().trim().min(1),
  sourceType: z.enum(["analysis_evidence_mention", "final_reference"]),
  subQuestionIds: z.array(z.string().trim().min(1)).default([]),
  url: z.string().trim().min(1).nullable().default(null),
}).strict();

export const DeepResearchFinalAdjudicationRecordSchema = z.object({
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  promptId: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  rawFinalAnswerText: z.string().trim().min(1),
  rawResponseHash: z.string().trim().min(1),
  preferredFormat: z.enum(["structured_text", "json_object", "markdown"]),
  parsedJsonIndex: z.unknown().nullable(),
  parseStatus: z.enum(["raw_structured_text", "parsed_json_index"]),
  promptBundleSnapshot: z.unknown(),
  createdAt: z.string().datetime(),
}).strict();

export const DeepResearchFinalAdjudicationParseSchema =
  DeepResearchFinalAdjudicationRecordSchema.omit({
    jobId: true,
    interactionId: true,
    promptId: true,
    promptVersion: true,
    promptBundleSnapshot: true,
    createdAt: true,
  });

const DeepResearchResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.literal("success"),
  jobStatus: z.literal("completed"),
  phase: DeepResearchPhaseSchema,
  finalAdjudication: DeepResearchFinalAdjudicationRecordSchema,
  recordHashes: z.record(z.string(), z.string()),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

const DeepResearchTerminalResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.enum(["failed", "review_required"]),
  jobStatus: z.enum(["failed", "review_required"]),
  phase: DeepResearchPhaseSchema,
  finalAdjudication: DeepResearchFinalAdjudicationRecordSchema.nullable(),
  recordHashes: z.record(z.string(), z.string()),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

export type DeepResearchFinalAdjudicationParse = z.infer<typeof DeepResearchFinalAdjudicationParseSchema>;
export type DeepResearchFinalAdjudicationRecord = z.infer<typeof DeepResearchFinalAdjudicationRecordSchema>;
export type DeepResearchSourceNote = z.infer<typeof DeepResearchSourceNoteSchema>;
export type DeepResearchResult =
  | z.infer<typeof DeepResearchResultSchema>
  | z.infer<typeof DeepResearchTerminalResultSchema>;
