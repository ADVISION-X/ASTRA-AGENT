import { z } from "zod";

const DEEP_RESEARCH_DECOMPOSITION_DIMENSIONS = [
  "facts",
  "causality",
  "impact",
  "evidence",
  "risk",
  "market",
  "valuation",
  "operations",
  "falsification",
] as const;

const DeepResearchQuestionTypeSchema = z.enum([
  "stock",
  "event",
  "policy",
  "business",
  "product",
  "strategy",
  "general",
  "unknown",
]);

const DeepResearchDecompositionDimensionSchema = z.enum(DEEP_RESEARCH_DECOMPOSITION_DIMENSIONS);
const DeepResearchDecompositionPrioritySchema = z.enum(["low", "medium", "high"]);

const DeepResearchDecompositionSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  questionText: z.string().trim().min(1),
  dimension: DeepResearchDecompositionDimensionSchema,
  purpose: z.string().trim().min(1),
  requiredEvidence: z.array(z.string().trim().min(1)).min(2),
  positiveAnalysisFocus: z.string().trim().min(1),
  falsificationFocus: z.string().trim().min(1),
  scope: z.string().trim().min(1),
  expectedAnswerShape: z.string().trim().min(1),
  priority: DeepResearchDecompositionPrioritySchema,
}).strict();

const DeepResearchDecompositionQualitySelfCheckSchema = z.object({
  coversFacts: z.boolean(),
  coversCausality: z.boolean(),
  coversImpact: z.boolean(),
  coversEvidence: z.boolean(),
  coversFalsification: z.boolean(),
  coversRisks: z.boolean(),
  hasNoDuplicateQuestions: z.boolean(),
  isReadyForPositiveAndFalsification: z.boolean(),
}).strict();

export const DeepResearchDecompositionResponseSchema = z.object({
  mainQuestion: z.string().trim().min(1),
  questionType: DeepResearchQuestionTypeSchema,
  decompositionStrategy: z.string().trim().min(1),
  missingInfo: z.array(z.string().trim().min(1)).default([]),
  subQuestions: z.array(DeepResearchDecompositionSubQuestionSchema).min(1),
  qualitySelfCheck: DeepResearchDecompositionQualitySelfCheckSchema,
}).strict();

export type DeepResearchDecompositionResponse = z.infer<typeof DeepResearchDecompositionResponseSchema>;
