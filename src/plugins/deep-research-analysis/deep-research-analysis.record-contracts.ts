import { z } from "zod";

import {
  DeepResearchInputSchema,
  DeepResearchInteractionPhaseSchema,
  DeepResearchJobStatusSchema,
  DeepResearchParseStatusSchema,
  DeepResearchPhaseSchema,
  DeepResearchSubQuestionSchema,
} from "./deep-research-analysis.schema.js";
import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";

export const DeepResearchProviderKindSchema = z.enum([
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
]);

const ResearchAnswerKindSchema = z.enum(["analysis"]);

const ResearchFlowModeSchema = z.literal("default_1_n_1_1");

const ResearchExportKindSchema = z.enum([
  "final-report.md",
  "full-case-file.md",
  "full-case-file.json",
  "structured-final-package.json",
  "business-report.html",
  "evidence-index.json",
]);

const ResearchParsedPayloadSchema = z.record(z.string(), z.unknown()).default({});

export const MISSING_RENDERED_PROMPT_TEXT =
  "[interaction did not persist rendered prompt text]";

export const ResearchJobSchema = z.object({
  id: z.string().trim().min(1),
  userQuestion: DeepResearchInputSchema.shape.userQuestion,
  analysisGoal: DeepResearchInputSchema.shape.analysisGoal,
  language: DeepResearchInputSchema.shape.language,
  maxSubQuestions: DeepResearchInputSchema.shape.maxSubQuestions,
  outputFormat: DeepResearchInputSchema.shape.outputFormat,
  flowMode: ResearchFlowModeSchema.default("default_1_n_1_1"),
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
  modelQuestionId: z.string().trim().min(1),
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
  renderedPromptText: z.string().trim().min(1),
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
  limitations: z.array(z.string().trim().min(1)).default([]),
  contradictionPoints: z.array(z.string().trim().min(1)).default([]),
  parsedPayload: ResearchParsedPayloadSchema,
  confidence: z.enum(["low", "medium", "high"]),
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
  payloadJson: z.string().trim().min(1),
  createdAt: z.string().datetime(),
}).strict();

export type ResearchJob = z.infer<typeof ResearchJobSchema>;
export type ResearchSubQuestion = z.infer<typeof ResearchSubQuestionSchema>;
export type ResearchInteraction = z.infer<typeof ResearchInteractionSchema>;
export type ResearchAnswer = z.infer<typeof ResearchAnswerSchema>;
export type ResearchAnswerKind = z.infer<typeof ResearchAnswerKindSchema>;
export type ResearchFinalReportRecord = z.infer<typeof ResearchFinalReportRecordSchema>;
export type ResearchExport = z.infer<typeof ResearchExportSchema>;
export type ResearchExportKind = z.infer<typeof ResearchExportKindSchema>;

export const DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH =
  "deep-research-analysis/deep_research_analysis.sqlite";
