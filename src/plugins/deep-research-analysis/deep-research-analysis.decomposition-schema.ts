import { z } from "zod";

const DeepResearchQuestionTypeSchema = z.enum([
  "stock",
  "event",
  "policy",
  "business",
  "product",
  "strategy",
  "finance",
  "crypto",
  "macro",
  "general",
  "unknown",
]);

const DeepResearchDecisionWeightSchema = z.enum([
  "decisive",
  "high",
  "medium",
  "low",
]);

const DeepResearchDecompositionPrioritySchema = z.enum(["low", "medium", "high"]);

const DeepResearchDecompositionSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  questionText: z.string().trim().min(1),
  whyItMatters: z.string().trim().min(1),
  decisionWeight: DeepResearchDecisionWeightSchema,
  analysisFocus: z.string().trim().min(1),
  requiredEvidence: z.array(z.string().trim().min(1)).min(2),
  scope: z.string().trim().min(1),
  expectedAnswerShape: z.string().trim().min(1),
  priority: DeepResearchDecompositionPrioritySchema,
  omissionRisk: z.string().trim().min(1),
}).strict();

const DeepResearchDecompositionExhaustivenessCheckSchema = z.object({
  keyDimensionsCovered: z.array(z.string().trim().min(1)).min(1),
  knownBlindSpots: z.array(z.string().trim().min(1)).default([]),
  whyNoMoreQuestionsAreNeeded: z.string().trim().min(1),
}).strict();

const DeepResearchDecompositionQualitySelfCheckSchema = z.object({
  isNeutral: z.boolean(),
  hasNoDuplicateQuestions: z.boolean(),
  hasNoPureFalsificationQuestions: z.boolean(),
  isReadyForIndependentAnalysis: z.boolean(),
  isReadyForFinalAdjudication: z.boolean(),
}).strict();

export const DeepResearchDecompositionResponseSchema = z.object({
  mainQuestion: z.string().trim().min(1),
  questionType: DeepResearchQuestionTypeSchema,
  decompositionStrategy: z.string().trim().min(1),
  missingInfo: z.array(z.string().trim().min(1)).default([]),
  subQuestions: z.array(DeepResearchDecompositionSubQuestionSchema).min(1),
  exhaustivenessCheck: DeepResearchDecompositionExhaustivenessCheckSchema,
  qualitySelfCheck: DeepResearchDecompositionQualitySelfCheckSchema,
}).strict();

export type DeepResearchDecompositionResponse = z.infer<typeof DeepResearchDecompositionResponseSchema>;
