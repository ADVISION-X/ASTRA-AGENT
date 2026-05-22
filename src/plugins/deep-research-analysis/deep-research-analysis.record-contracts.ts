import { z } from "zod";

import {
  DeepResearchInputSchema,
  DeepResearchInteractionPhaseSchema,
  DeepResearchJobStatusSchema,
  DeepResearchParseStatusSchema,
  DeepResearchPhaseSchema,
  DeepResearchSubQuestionSchema,
} from "./deep-research-analysis.schema.js";
import {
  DeepResearchConflictMatrixRowSchema,
  DeepResearchFinalReportSchema,
} from "./deep-research-analysis.result.js";

export const DeepResearchProviderKindSchema = z.enum([
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
]);

const ResearchAnswerKindSchema = z.enum(["positive", "falsification"]);

const ResearchExportKindSchema = z.enum([
  "final-report.md",
  "research-bundle.json",
  "evidence-index.json",
]);

export const ResearchJobSchema = z.object({
  id: z.string().trim().min(1),
  userQuestion: DeepResearchInputSchema.shape.userQuestion,
  analysisGoal: DeepResearchInputSchema.shape.analysisGoal,
  language: DeepResearchInputSchema.shape.language,
  maxSubQuestions: DeepResearchInputSchema.shape.maxSubQuestions,
  outputFormat: DeepResearchInputSchema.shape.outputFormat,
  status: DeepResearchJobStatusSchema,
  phase: DeepResearchPhaseSchema,
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const ResearchSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  ordinal: z.number().int().nonnegative(),
  question: DeepResearchSubQuestionSchema,
  createdAt: z.string().datetime(),
}).strict();

export const ResearchInteractionSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  phase: DeepResearchInteractionPhaseSchema,
  subQuestionId: z.string().trim().min(1).nullable().default(null),
  promptId: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  promptHash: z.string().trim().min(1),
  domRef: z.string().trim().min(1).nullable().default(null),
  rawResponseText: z.string().trim().min(1),
  rawResponseHash: z.string().trim().min(1),
  normalizedText: z.string().trim().min(1).nullable().default(null),
  parseStatus: DeepResearchParseStatusSchema,
  providerKind: DeepResearchProviderKindSchema.nullable().default(null),
  providerProofJson: z.string().trim().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchAnswerSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  subQuestionId: z.string().trim().min(1),
  answerKind: ResearchAnswerKindSchema,
  answerText: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim().min(1)).default([]),
  evidenceMentions: z.array(z.string().trim().min(1)).default([]),
  assumptions: z.array(z.string().trim().min(1)).default([]),
  limitations: z.array(z.string().trim().min(1)).min(1),
  contradictionPoints: z.array(z.string().trim().min(1)).default([]),
  confidence: z.enum(["low", "medium", "high"]),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchConflictMatrixSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  row: DeepResearchConflictMatrixRowSchema.extend({
    subQuestionId: z.string().trim().min(1),
  }),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchFinalReportRecordSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  report: DeepResearchFinalReportSchema,
  reportHash: z.string().trim().min(1),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchExportSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  exportKind: ResearchExportKindSchema,
  filePath: z.string().trim().min(1),
  fileHash: z.string().trim().min(1),
  payloadHash: z.string().trim().min(1),
  createdAt: z.string().datetime(),
}).strict();

export type ResearchJob = z.infer<typeof ResearchJobSchema>;
export type ResearchSubQuestion = z.infer<typeof ResearchSubQuestionSchema>;
export type ResearchInteraction = z.infer<typeof ResearchInteractionSchema>;
export type ResearchAnswer = z.infer<typeof ResearchAnswerSchema>;
export type ResearchAnswerKind = z.infer<typeof ResearchAnswerKindSchema>;
export type ResearchConflictMatrix = z.infer<typeof ResearchConflictMatrixSchema>;
export type ResearchFinalReportRecord = z.infer<typeof ResearchFinalReportRecordSchema>;
export type ResearchExport = z.infer<typeof ResearchExportSchema>;
export type ResearchExportKind = z.infer<typeof ResearchExportKindSchema>;

export const DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH =
  "deep-research-analysis/deep_research_analysis.sqlite";