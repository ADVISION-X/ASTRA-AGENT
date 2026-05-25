import { z } from "zod";

import {
  DeepResearchInteractionPhaseSchema,
  DeepResearchParseStatusSchema,
} from "./deep-research-analysis.schema.js";

const DeepResearchFullCaseFileJobSchema = z.object({
  jobId: z.string().trim().min(1),
  userQuestion: z.string().trim().min(1),
  analysisGoal: z.string().trim().min(1).nullable(),
  language: z.string().trim().min(1),
  createdAt: z.string().datetime(),
}).strict();

const DeepResearchCaseInteractionSchema = z.object({
  interactionId: z.string().trim().min(1),
  promptId: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  renderedPromptText: z.string(),
  rawResponseText: z.string(),
  rawResponseHash: z.string().trim().min(1),
  normalizedText: z.string().nullable(),
  parseStatus: DeepResearchParseStatusSchema,
}).strict();

const DeepResearchCasePromptInteractionSchema = DeepResearchCaseInteractionSchema.extend({
  providerProofJson: z.string().nullable(),
}).strict();

const DeepResearchCaseDecompositionSchema = DeepResearchCaseInteractionSchema.extend({
  parsedSubQuestions: z.array(z.unknown()),
}).strict();

export const DeepResearchStructuredAnswerStatusSchema = z.enum([
  "parsed",
  "missing",
  "parse_failed_raw_available",
]);

const DeepResearchFullCaseFileSubQuestionAnalysisSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  modelQuestionId: z.string().trim().min(1).nullable(),
  title: z.string().trim().min(1).nullable(),
  questionText: z.string().trim().min(1),
  promptInteraction: DeepResearchCasePromptInteractionSchema.nullable(),
  structuredAnswer: z.unknown().nullable(),
  structuredAnswerStatus: DeepResearchStructuredAnswerStatusSchema,
}).strict();

const DeepResearchFailedRawInteractionSchema = z.object({
  interactionId: z.string().trim().min(1),
  phase: DeepResearchInteractionPhaseSchema,
  subQuestionId: z.string().trim().min(1).nullable(),
  promptId: z.string().trim().min(1),
  renderedPromptText: z.string(),
  rawResponseText: z.string(),
  rawResponseHash: z.string().trim().min(1),
  parseStatus: DeepResearchParseStatusSchema,
}).strict();

const DeepResearchFullCaseFileCoverageSchema = z.object({
  totalSubQuestionCount: z.number().int().nonnegative(),
  structuredAnalysisCount: z.number().int().nonnegative(),
  rawAnalysisInteractionCount: z.number().int().nonnegative(),
  rawCoverageRatio: z.number().min(0).max(1),
  structuredCoverageRatio: z.number().min(0).max(1),
}).strict();

export const DeepResearchFullCaseFileSchema = z.object({
  caseFileVersion: z.literal("v1"),
  job: DeepResearchFullCaseFileJobSchema,
  decomposition: DeepResearchCaseDecompositionSchema.nullable(),
  subQuestionAnalyses: z.array(DeepResearchFullCaseFileSubQuestionAnalysisSchema),
  failedButRawAvailableInteractions: z.array(DeepResearchFailedRawInteractionSchema),
  structuredFinalPackage: z.unknown(),
  sourceNotes: z.array(z.unknown()),
  recordHashes: z.record(z.string(), z.string()),
  coverage: DeepResearchFullCaseFileCoverageSchema,
}).strict();

export type DeepResearchFullCaseFile = z.infer<typeof DeepResearchFullCaseFileSchema>;
